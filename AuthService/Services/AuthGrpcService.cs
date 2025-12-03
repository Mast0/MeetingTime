using Grpc.Core;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Protos;
using Shared.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuthService.Services;

public class AuthGrpcService : Protos.Auth.AuthBase
{
    private readonly UserManager<UserEntity> _userManager;
    private readonly IConfiguration _configuration;

    public AuthGrpcService(
        UserManager<UserEntity> userManager, 
        IConfiguration configuration)
    {
        _userManager = userManager;
        _configuration = configuration;
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

    public override async Task<ValidateResponse> Validate(ValidateRequest request, ServerCallContext context)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"];

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(request.Token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ValidateIssuer = true,
                ValidIssuer = jwtSettings["Issuer"],
                ValidateAudience = true,
                ValidAudience = jwtSettings["Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out var securityToken);

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return new ValidateResponse { IsValid = true, UserId = userId ?? "" };
        }
        catch (Exception ex)
        {
            return new ValidateResponse { IsValid = false, Error = ex.Message };
        }
    }

    private async Task<AuthResponse> GenerateToken(UserEntity user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"];
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.Id)
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            expires: DateTime.UtcNow.AddHours(int.Parse(jwtSettings["ExpirationTime"])),
            claims: claims,
            signingCredentials: creds
        );

        return new AuthResponse { Token = new JwtSecurityTokenHandler().WriteToken(token) };
    }
}
