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
}
