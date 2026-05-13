using BC = BCrypt.Net.BCrypt;
using Grpc.Core;
using MeetingTime.Domain.Entities;
using Protos;
using Shared.Domain.Interfaces;
using StackExchange.Redis;
using System.Text.Json;

namespace RoomService.Services;

public class RoomGrpcService : Room.RoomBase
{
    private static readonly TimeSpan RoomTtl      = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan UserRoomsTtl = TimeSpan.FromMinutes(2);
    private static readonly JsonSerializerOptions JsonOpt = new() { PropertyNameCaseInsensitive = true };

    private readonly IRoomRepository _repo;
    private readonly IDatabase _redis;

    public RoomGrpcService(IRoomRepository repo, IConnectionMultiplexer redis)
    {
        _repo  = repo;
        _redis = redis.GetDatabase();
    }

    public override async Task<RoomResponse> CreateRoom(CreateRoomRequest request, ServerCallContext context)
    {
        var room = new RoomEntity
        {
            Id       = Guid.NewGuid(),
            Name     = request.Name,
            Password = string.IsNullOrEmpty(request.Password)
                           ? ""
                           : BC.HashPassword(request.Password),
        };

        var roomResponse = await _repo.AddAsync(room);

        if (!string.IsNullOrEmpty(request.CreatorUserId))
        {
            await _repo.AddMemberAsync(roomResponse.Id, request.CreatorUserId, "owner");
            await _redis.KeyDeleteAsync(UserRoomsKey(request.CreatorUserId));
        }

        return ToResponse(roomResponse);
    }

    public override async Task<RoomResponse> GetRoom(GetRoomRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.RoomId, out var guid))
            return new RoomResponse();

        var cacheKey = RoomKey(request.RoomId);
        var cached   = await _redis.StringGetAsync(cacheKey);

        if (cached.HasValue)
        {
            var dto = JsonSerializer.Deserialize<CachedRoom>(cached!, JsonOpt);
            if (dto != null) return DtoToResponse(dto);
        }

        var room = await _repo.GetByIdAsync(guid);
        if (room == null) return new RoomResponse();

        var response = ToResponse(room);
        await _redis.StringSetAsync(cacheKey, JsonSerializer.Serialize(ToCachedRoom(room), JsonOpt), RoomTtl);
        return response;
    }

    public override async Task<RoomsResponse> GetRooms(Empty request, ServerCallContext context)
    {
        var rooms    = (await _repo.ListAsync()).Select(ToResponse);
        var response = new RoomsResponse();
        response.Rooms.AddRange(rooms);
        return response;
    }

    public override async Task<RoomResponse> UpdateRoom(UpdateRoomRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.RoomId, out var guid))
            return new RoomResponse();

        var room = await _repo.GetByIdAsync(guid);
        if (room == null) return new RoomResponse();

        room.Name = request.Name;

        // Only re-hash if a new password was explicitly provided
        if (!string.IsNullOrEmpty(request.Password))
            room.Password = BC.HashPassword(request.Password);
        else
            room.Password = "";

        await _repo.UpdateAsync(room);

        await _redis.KeyDeleteAsync(RoomKey(request.RoomId));
        return ToResponse(room);
    }

    public override async Task<Empty> DeleteRoom(DeleteRoomRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var guid))
        {
            await _repo.DeleteAsync(guid);
            await _redis.KeyDeleteAsync(RoomKey(request.RoomId));
        }
        return new Empty();
    }

    public override async Task<CheckRoomPasswordResponse> CheckRoomPassword(CheckRoomPasswordRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.RoomId, out var guid))
            return new CheckRoomPasswordResponse { Valid = false };

        var room = await _repo.GetByIdAsync(guid);
        if (room == null)
            return new CheckRoomPasswordResponse { Valid = false };

        // Room has no password — always valid (shouldn't be called, but guard anyway)
        if (string.IsNullOrEmpty(room.Password))
            return new CheckRoomPasswordResponse { Valid = true };

        var valid = BC.Verify(request.Password, room.Password);
        return new CheckRoomPasswordResponse { Valid = valid };
    }

    // ─── Membership RPCs ───

    public override async Task<RoomMemberResponse> AddRoomMember(AddRoomMemberRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.RoomId, out var roomId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid room ID"));

        await _repo.AddMemberAsync(roomId, request.UserId, "member");
        await _redis.KeyDeleteAsync(UserRoomsKey(request.UserId));

        return new RoomMemberResponse
        {
            RoomId   = request.RoomId,
            UserId   = request.UserId,
            Role     = "member",
            JoinedAt = DateTimeOffset.UtcNow.ToString("o")
        };
    }

    public override async Task<Empty> RemoveRoomMember(RemoveRoomMemberRequest request, ServerCallContext context)
    {
        if (Guid.TryParse(request.RoomId, out var roomId))
        {
            await _repo.RemoveMemberAsync(roomId, request.UserId);
            await _redis.KeyDeleteAsync(UserRoomsKey(request.UserId));
        }
        return new Empty();
    }

    public override async Task<RoomMembersResponse> GetRoomMembers(GetRoomMembersRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.RoomId, out var roomId))
            return new RoomMembersResponse();

        var members  = await _repo.GetMembersAsync(roomId);
        var response = new RoomMembersResponse();

        response.Members.AddRange(members.Select(m => new RoomMemberResponse
        {
            RoomId   = m.RoomId.ToString(),
            UserId   = m.UserId,
            Role     = m.Role,
            JoinedAt = m.JoinedAt.ToString("o")
        }));

        return response;
    }

    public override async Task<RoomsResponse> GetRoomsByUser(GetRoomsByUserRequest request, ServerCallContext context)
    {
        var cacheKey = UserRoomsKey(request.UserId);
        var cached   = await _redis.StringGetAsync(cacheKey);

        if (cached.HasValue)
        {
            var dtos = JsonSerializer.Deserialize<List<CachedRoom>>(cached!, JsonOpt);
            if (dtos != null)
            {
                var hit = new RoomsResponse();
                hit.Rooms.AddRange(dtos.Select(DtoToResponse));
                return hit;
            }
        }

        var rooms    = await _repo.ListByUserAsync(request.UserId);
        var response = new RoomsResponse();
        response.Rooms.AddRange(rooms.Select(ToResponse));

        var cachedDtos = rooms.Select(ToCachedRoom).ToList();
        await _redis.StringSetAsync(cacheKey, JsonSerializer.Serialize(cachedDtos, JsonOpt), UserRoomsTtl);

        return response;
    }

    public override async Task<RoomsResponse> SearchPublicRooms(SearchPublicRoomsRequest request, ServerCallContext context)
    {
        if (request.Query.Count() < 2) return new RoomsResponse();

        var rooms    = await _repo.SearchPublicRoomsAsync(request.Query);
        var response = new RoomsResponse();
        response.Rooms.AddRange(rooms.Select(r => new RoomResponse
        {
            RoomId      = r.Id.ToString(),
            Name        = r.Name,
            HasPassword = !string.IsNullOrEmpty(r.Password)
        }));

        return response;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static RoomResponse ToResponse(RoomEntity r) => new()
    {
        RoomId      = r.Id.ToString(),
        Name        = r.Name,
        HasPassword = !string.IsNullOrEmpty(r.Password)
    };

    /// <summary>
    /// Plain POCO used for Redis caching.
    /// </summary>
    private sealed record CachedRoom(
        string RoomId,
        string Name,
        bool   HasPassword);

    private static CachedRoom ToCachedRoom(RoomEntity r) =>
        new(r.Id.ToString(), r.Name, !string.IsNullOrEmpty(r.Password));

    private static RoomResponse DtoToResponse(CachedRoom dto) => new()
    {
        RoomId      = dto.RoomId,
        Name        = dto.Name,
        HasPassword = dto.HasPassword
    };

    private static string RoomKey(string roomId)      => $"room:{roomId}";
    private static string UserRoomsKey(string userId) => $"rooms:user:{userId}";
}
