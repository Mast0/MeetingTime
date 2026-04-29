using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Protos;

namespace ApiGateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly Auth.AuthClient _authClient;

    public AuthController(Auth.AuthClient authClient)
    {
        _authClient = authClient;
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
}
