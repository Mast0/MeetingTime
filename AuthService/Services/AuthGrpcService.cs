using Grpc.Core;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Protos;
using Shared.Domain.Entities;
using StackExchange.Redis;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuthService.Services;

public class AuthGrpcService : Protos.Auth.AuthBase
{
    private readonly UserManager<UserEntity> _userManager;
    private readonly IConfiguration _configuration;
    private readonly IDatabase _redis;

    public AuthGrpcService(
        UserManager<UserEntity> userManager,
        IConfiguration configuration,
        IConnectionMultiplexer redis)
    {
        _userManager   = userManager;
        _configuration = configuration;
        _redis         = redis.GetDatabase();
    }

    public override async Task<AuthResponse> Register(RegisterRequest request, ServerCallContext context)
    {
        var user = new UserEntity
        {
            UserName = request.Username,
            Email = request.Email,
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return new AuthResponse { Error = string.Join(",", result.Errors.Select(e => e.Description)) };
        }

        return await GenerateToken(user);
    }

    public async override Task<AuthResponse> Login(LoginRequest request, ServerCallContext context)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null) return new AuthResponse { Error = "Invalid email or password" };

        var passwordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid) return new AuthResponse{ Error = "Invalid email or password" };

        return await GenerateToken(user);
    }

    public override async Task<User> GetUser(UserRequest request, ServerCallContext context)
    {
        var user = await _userManager.FindByIdAsync(request.Id);
        if (user == null) return null;

        return new User 
        {
            Id = user.Id,
            UserName = user.UserName,
            Email = user.Email,
        };
    }

    public override async Task<Users> GetUsersByIds(UsersRequest request, ServerCallContext context)
    {
        var users = _userManager.Users.Where(u => request.Ids.Contains(u.Id));

        var response = new Users();

        response.Users_.AddRange(users.Select(u => new User 
        { 
            Id = u.Id,
            UserName = u.UserName,
            Email = u.Email,
        }));

        return response;
    }

    public override async Task<Users> SearchUsers(SearchUsersRequest request, ServerCallContext context)
    {
        var query = request.Query?.Trim().ToLower() ?? "";
        if (string.IsNullOrEmpty(query))
            return new Users();

        // Fetch users into memory (since we have a small DB, it's fine for now, but ideally we'd cache this or use a search index)
        var allUsers = await _userManager.Users.ToListAsync();

        var scoredUsers = allUsers
            .Select(u => new
            {
                User = u,
                Score = Math.Max(
                    FuzzySharp.Fuzz.WeightedRatio(query, u.UserName?.ToLower() ?? ""),
                    FuzzySharp.Fuzz.WeightedRatio(query, u.Email?.ToLower() ?? "")
                )
            })
            .Where(x => x.Score >= 50)
            .OrderByDescending(x => x.Score)
            .Take(10)
            .Select(x => x.User);

        var response = new Users();
        response.Users_.AddRange(scoredUsers.Select(u => new User
        {
            Id = u.Id,
            UserName = u.UserName ?? "",
            Email = u.Email ?? "",
        }));

        return response;
    }

    public override async Task<ValidateResponse> Validate(ValidateRequest request, ServerCallContext context)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey   = jwtSettings["SecretKey"];

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(request.Token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey        = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ValidateIssuer          = true,
                ValidIssuer             = jwtSettings["Issuer"],
                ValidateAudience        = true,
                ValidAudience           = jwtSettings["Audience"],
                ValidateLifetime        = true,
                ClockSkew               = TimeSpan.Zero
            }, out var securityToken);

            // Check JWT blacklist — token may have been invalidated by Logout
            var jwt = securityToken as JwtSecurityToken;
            var jti = jwt?.Id;
            if (!string.IsNullOrEmpty(jti) && await _redis.KeyExistsAsync(BlacklistKey(jti)))
                return new ValidateResponse { IsValid = false, Error = "Token has been revoked" };

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return new ValidateResponse { IsValid = true, UserId = userId ?? "" };
        }
        catch (Exception ex)
        {
            return new ValidateResponse { IsValid = false, Error = ex.Message };
        }
    }

    public override Task<LogoutResponse> Logout(LogoutRequest request, ServerCallContext context)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            // Parse without validating signature — we just need the claims
            var jwt = handler.ReadJwtToken(request.Token);
            var jti = jwt.Id;
            if (string.IsNullOrEmpty(jti))
                return Task.FromResult(new LogoutResponse { Success = false });

            var remaining = jwt.ValidTo - DateTime.UtcNow;
            if (remaining > TimeSpan.Zero)
                _redis.StringSet(BlacklistKey(jti), "1", remaining);

            return Task.FromResult(new LogoutResponse { Success = true });
        }
        catch
        {
            return Task.FromResult(new LogoutResponse { Success = false });
        }
    }

    private static string BlacklistKey(string jti) => $"blacklist:{jti}";

    public override async Task<UpdateProfileResponse> UpdateProfile(UpdateProfileRequest request, ServerCallContext context)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return new UpdateProfileResponse { Success = false, Error = "User not found" };

        if (!string.IsNullOrWhiteSpace(request.NewUsername) && request.NewUsername != user.UserName)
        {
            var usernameResult = await _userManager.SetUserNameAsync(user, request.NewUsername);
            if (!usernameResult.Succeeded)
                return new UpdateProfileResponse { Success = false, Error = string.Join(", ", usernameResult.Errors.Select(e => e.Description)) };
        }

        if (!string.IsNullOrWhiteSpace(request.NewEmail) && request.NewEmail != user.Email)
        {
            var token = await _userManager.GenerateChangeEmailTokenAsync(user, request.NewEmail);
            var emailResult = await _userManager.ChangeEmailAsync(user, request.NewEmail, token);
            if (!emailResult.Succeeded)
                return new UpdateProfileResponse { Success = false, Error = string.Join(", ", emailResult.Errors.Select(e => e.Description)) };
        }

        return new UpdateProfileResponse { Success = true };
    }

    public override async Task<ChangePasswordResponse> ChangePassword(ChangePasswordRequest request, ServerCallContext context)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return new ChangePasswordResponse { Success = false, Error = "User not found" };

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return new ChangePasswordResponse { Success = false, Error = string.Join(", ", result.Errors.Select(e => e.Description)) };

        return new ChangePasswordResponse { Success = true };
    }

    private Task<AuthResponse> GenerateToken(UserEntity user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"];
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // unique token ID for blacklisting
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.Id)
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            expires: DateTime.UtcNow.AddHours(int.TryParse(jwtSettings["ExpirationTime"], out var exp) ? exp : 3),
            claims: claims,
            signingCredentials: creds
        );

        return Task.FromResult(new AuthResponse { Token = new JwtSecurityTokenHandler().WriteToken(token) });
    }
}
