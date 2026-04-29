using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Protos;
using System.Security.Claims;

namespace ApiGateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoomController : ControllerBase
{
    private readonly Room.RoomClient _roomClient;

    public RoomController(Room.RoomClient roomClient)
    {
        _roomClient = roomClient;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateRoom(CreateRoomRequest req)
    {
        // Inject the authenticated user's ID as the room creator
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        req.CreatorUserId = userId ?? "";

        var res = await _roomClient.CreateRoomAsync(req);
        return Ok(res);
    }

    [Authorize]
    [HttpGet("get-room")]
    public async Task<IActionResult> GetRoom(GetRoomRequest req)
    {
        var res = await _roomClient.GetRoomAsync(req);
        return Ok(res);
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetRooms()
    {
        var res = await _roomClient.GetRoomsAsync(new Empty());
        return Ok(res);
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyRooms()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var res = await _roomClient.GetRoomsByUserAsync(new GetRoomsByUserRequest { UserId = userId });
        return Ok(res);
    }

    [Authorize]
    [HttpPut]
    public async Task<IActionResult> UpdateRoom(UpdateRoomRequest req)
    {
        var res = await _roomClient.UpdateRoomAsync(req);
        return Ok(res);
    }

    [Authorize]
    [HttpDelete]
    public async Task<IActionResult> DeleteRoom(DeleteRoomRequest req)
    {
        var res = await _roomClient.DeleteRoomAsync(req);
        return Ok(res);
    }

    // ─── Membership Endpoints ───

    [Authorize]
    [HttpPost("{roomId}/members")]
    public async Task<IActionResult> AddMember(string roomId, [FromBody] AddMemberRequest body)
    {
        var res = await _roomClient.AddRoomMemberAsync(new AddRoomMemberRequest
        {
            RoomId = roomId,
            UserId = body.UserId
        });
        return Ok(res);
    }

    [Authorize]
    [HttpDelete("{roomId}/members/{userId}")]
    public async Task<IActionResult> RemoveMember(string roomId, string userId)
    {
        var res = await _roomClient.RemoveRoomMemberAsync(new RemoveRoomMemberRequest
        {
            RoomId = roomId,
            UserId = userId
        });
        return Ok(res);
    }

    [Authorize]
    [HttpGet("{roomId}/members")]
    public async Task<IActionResult> GetMembers(string roomId)
    {
        var res = await _roomClient.GetRoomMembersAsync(new GetRoomMembersRequest
        {
            RoomId = roomId
        });
        return Ok(res);
    }

    [Authorize]
    [HttpGet("public/search")]
    public async Task<IActionResult> SearchPublicRooms([FromQuery] string query = "")
    {
        var res = await _roomClient.SearchPublicRoomsAsync(new SearchPublicRoomsRequest { Query = query ?? "" });
        return Ok(res);
    }
}

// Simple DTO for the add-member request body
public class AddMemberRequest
{
    public string UserId { get; set; } = "";
}
