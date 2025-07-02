using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Protos;

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
        var res = await _roomClient.CreateRoomAsync(req);
        return Ok(res);
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetRoom(GetRoomRequest req)
    {
        var res = await _roomClient.GetRoomAsync(req);
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
}
