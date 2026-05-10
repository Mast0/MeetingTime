using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Protos;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ApiGateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly Auth.AuthClient _authClient;
    private readonly IConfiguration _config;

    public AuthController(Auth.AuthClient authClient, IConfiguration config)
    {
        _authClient = authClient;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var response = await _authClient.RegisterAsync(req);
        return string.IsNullOrEmpty(response.Error) ? Ok(response.Token) : BadRequest(response.Error);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var response = await _authClient.LoginAsync(req);
        return string.IsNullOrEmpty(response.Error) ? Ok(response.Token) : BadRequest(response.Error);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        // Extract the raw Bearer token from the Authorization header
        var authHeader = Request.Headers.Authorization.ToString();
        var token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].Trim()
            : string.Empty;

        if (string.IsNullOrEmpty(token))
            return BadRequest("No token provided");

        var response = await _authClient.LogoutAsync(new LogoutRequest { Token = token });
        return response.Success ? Ok() : BadRequest("Failed to revoke token");
    }

    [Authorize]
    [HttpPost("user")]
    public async Task<IActionResult> GetUser(UserRequest req)
    {
        var response = await _authClient.GetUserAsync(req);
        if (response == null) return NotFound();

        return Ok(response);
    }

    [Authorize]
    [HttpGet("search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return Ok(new { users = Array.Empty<object>() });

        var response = await _authClient.SearchUsersAsync(new SearchUsersRequest { Query = query });
        return Ok(new { users = response.Users_ });
    }

    /// <summary>
    /// Issues a short-lived guest JWT for non-authenticated users joining a meeting via invite link.
    /// No AuthService call needed — the token is signed locally with the same secret.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("guest")]
    public IActionResult GuestToken([FromBody] GuestTokenRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.DisplayName))
            return BadRequest("Display name is required.");

        var jwtSettings = _config.GetSection("JwtSettings");
        var secretKey   = jwtSettings["SecretKey"]!;
        var issuer      = jwtSettings["Issuer"]!;
        var audience    = jwtSettings["Audience"]!;

        var guestId = $"guest-{Guid.NewGuid()}";

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  guestId),
            new Claim(JwtRegisteredClaimNames.Name, req.DisplayName),
            new Claim("role", "guest"),
        };

        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             issuer,
            audience:           audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(2),
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return Ok(new { token = tokenString, displayName = req.DisplayName, guestId });
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var response = await _authClient.UpdateProfileAsync(new UpdateProfileRequest
        {
            UserId      = userId,
            NewUsername = dto.Username ?? "",
            NewEmail    = dto.Email    ?? "",
        });

        return response.Success ? Ok() : BadRequest(response.Error);
    }

    [Authorize]
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var response = await _authClient.ChangePasswordAsync(new ChangePasswordRequest
        {
            UserId          = userId,
            CurrentPassword = dto.CurrentPassword,
            NewPassword     = dto.NewPassword,
        });

        return response.Success ? Ok() : BadRequest(response.Error);
    }
}

public class GuestTokenRequest
{
    public string DisplayName { get; set; } = "";
    public string RoomId      { get; set; } = "";
}

public class UpdateProfileDto
{
    public string? Username { get; set; }
    public string? Email    { get; set; }
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword     { get; set; } = "";
}
