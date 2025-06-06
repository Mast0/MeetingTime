using Grpc.Core;
using MeetingTime.Domain.Entities;
using Microsoft.EntityFrameworkCore;
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
            Quality = request.Quality,
            Password = request.Password,
        };

        var roomResponse = await _repo.AddAsync(room);

        return new RoomResponse
        {
            RoomId = roomResponse.Id.ToString(),
            Name = roomResponse.Name,
            MaxParticipiants = roomResponse.MaxParticipiants,
            Quality = roomResponse.Quality,
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
                Quality = room.Quality,
                Password = room.Password
            };
        }
        return new RoomResponse();
    }

    public override async Task<RoomResponse> UpdateRoom(UpdateRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            var room = await _repo.GetByIdAsync(guid);
            if (room == null) return new RoomResponse();
            room.Name = request.Name;
            room.MaxParticipiants = request.MaxParticipiants;
            room.Quality = request.Quality;
            room.Password = request.Password;
            return new RoomResponse
            {
                RoomId = room.Id.ToString(),
                Name = room.Name,
                MaxParticipiants = room.MaxParticipiants,
                Quality = room.Quality,
                Password = room.Password
            };
        }
        return new RoomResponse();
    }

    public override Task<Empty> DeleteRoom(DeleteRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            _repo.DeleteAsync(guid);
            return Task.FromResult(new Empty());
        }
        return Task.FromResult(new Empty());
    }
}
