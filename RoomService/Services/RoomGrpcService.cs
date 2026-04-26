using Grpc.Core;
using MeetingTime.Domain.Entities;
using Protos;
using Shared.Domain.Interfaces;

namespace RoomService.Services;

public class RoomGrpcService : Room.RoomBase
{
    private readonly IRoomRepository _repo;

    public RoomGrpcService(IRoomRepository repo)
    {
        _repo = repo;
    }

    public override async Task<RoomResponse> CreateRoom(CreateRoomRequest request, ServerCallContext context)
    {
        var room = new RoomEntity
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            MaxParticipiants = request.MaxParticipiants,
            Password = request.Password,
        };

        var roomResponse = await _repo.AddAsync(room);

        return new RoomResponse
        {
            RoomId = roomResponse.Id.ToString(),
            Name = roomResponse.Name,
            MaxParticipiants = roomResponse.MaxParticipiants,
            Password = roomResponse.Password
        };
    }

    public override async Task<RoomResponse> GetRoom(GetRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            var room = await _repo.GetByIdAsync(guid);

            if (room == null) return new RoomResponse();

            return new RoomResponse
            {
                RoomId = room.Id.ToString(),
                Name = room.Name,
                MaxParticipiants = room.MaxParticipiants,
                Password = room.Password
            };
        }
        return new RoomResponse();
    }

    public override async Task<RoomsResponse> GetRooms(Empty request, ServerCallContext context)
    {
        var rooms = (await _repo.ListAsync()).Select(r => new RoomResponse
        {
            RoomId = r.Id.ToString(),
            Name = r.Name,
            MaxParticipiants = r.MaxParticipiants,
            Password = r.Password
        });

        var response = new RoomsResponse();
        response.Rooms.AddRange(rooms);
        return response;
    }

    public override async Task<RoomResponse> UpdateRoom(UpdateRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            var room = await _repo.GetByIdAsync(guid);
            if (room == null) return new RoomResponse();
            room.Name = request.Name;
            room.MaxParticipiants = request.MaxParticipiants;
            room.Password = request.Password;
            await _repo.UpdateAsync(room);
            return new RoomResponse
            {
                RoomId = room.Id.ToString(),
                Name = room.Name,
                MaxParticipiants = room.MaxParticipiants,
                Password = room.Password
            };
        }
        return new RoomResponse();
    }

    public override async Task<Empty> DeleteRoom(DeleteRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            await _repo.DeleteAsync(guid);
        }
        return new Empty();
    }
}
