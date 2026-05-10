using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Protos;

namespace ApiGateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PresenceController : ControllerBase
{
    private readonly Chat.ChatClient _chatClient;

    public PresenceController(Chat.ChatClient chatClient)
    {
        _chatClient = chatClient;
    }

    /// <summary>
    /// Returns which of the supplied user IDs are currently online.
    /// Query: GET /api/presence?userIds=id1&userIds=id2&...
    /// </summary>
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetPresence([FromQuery] List<string> userIds)
    {
        if (userIds == null || userIds.Count == 0)
            return Ok(new { onlineUserIds = Array.Empty<string>() });

        var req = new GetPresenceRequest();
        req.UserIds.AddRange(userIds);

        var res = await _chatClient.GetPresenceAsync(req);
        return Ok(new { onlineUserIds = res.OnlineUserIds.ToList() });
    }
}
