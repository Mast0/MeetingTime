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
    [HttpPost("rooms")]
    public async Task<IActionResult> GetMessages(MessagesRequest req)
    {
        var res = await _chatClient.GetMessagesAsync(req);
        return Ok(res);
    }
}
