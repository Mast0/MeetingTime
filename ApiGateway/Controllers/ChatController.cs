using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Protos;

namespace ApiGateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly Chat.ChatClient _chatClient;

    public ChatController(Chat.ChatClient chatClient)
    {
        _chatClient = chatClient;
    }

    [Authorize]
    [HttpGet("rooms/{roomId}/messages")]
    public async Task<IActionResult> GetMessages(
        string roomId,
        [FromQuery] long beforeTimestamp = 0,
        [FromQuery] int pageSize = 0)
    {
        var req = new MessagesRequest
        {
            RoomId          = roomId,
            BeforeTimestamp = beforeTimestamp,
            PageSize        = pageSize,
        };

        var res = await _chatClient.GetMessagesAsync(req);
        return Ok(res);
    }
}
