using MeetingTime.Domain.Data;
using MeetingTime.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using FuzzySharp;

namespace AuthService.Repositories;

public class RoomRepository : IRoomRepository
{
    private readonly MeetingTimeContext _context;

    public RoomRepository(MeetingTimeContext context)
    {
        _context = context;
    }

    public async Task<RoomEntity> AddAsync(RoomEntity room)
    {
        await _context.Rooms.AddAsync(room);
        await _context.SaveChangesAsync();
        return room;
    }

    public async Task DeleteAsync(Guid id)
    {
        var entity = await _context.Rooms.FindAsync(id);
        if (entity is null) return;
        _context.Rooms.Remove(entity);
        await _context.SaveChangesAsync();
    }

    public async Task<RoomEntity?> GetByIdAsync(Guid id)
    {
        return await _context.Rooms.FindAsync(id);
    }

    public async Task<IEnumerable<RoomEntity>> ListAsync()
    {
        return await _context.Rooms.ToListAsync();
    }

    public async Task<RoomEntity> UpdateAsync(RoomEntity room)
    {
        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();
        return room;
    }

    // ─── Membership ───

    public async Task AddMemberAsync(Guid roomId, string userId, string role)
    {
        var exists = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

        if (exists) return;

        var member = new RoomMemberEntity
        {
            RoomId = roomId,
            UserId = userId,
            Role = role,
            JoinedAt = DateTimeOffset.UtcNow
        };

        await _context.RoomMembers.AddAsync(member);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(Guid roomId, string userId)
    {
        var member = await _context.RoomMembers
            .FirstOrDefaultAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

        if (member is null) return;

        _context.RoomMembers.Remove(member);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<RoomEntity>> ListByUserAsync(string userId)
    {
        return await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Include(rm => rm.Room)
            .Select(rm => rm.Room)
            .ToListAsync();
    }

    public async Task<IEnumerable<RoomMemberEntity>> GetMembersAsync(Guid roomId)
    {
        return await _context.RoomMembers
            .Where(rm => rm.RoomId == roomId)
            .Include(rm => rm.User)
            .ToListAsync();
    }

    public async Task<bool> IsMemberAsync(Guid roomId, string userId)
    {
        return await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == userId);
    }

    public async Task<IEnumerable<RoomEntity>> SearchPublicRoomsAsync(string query)
    {
        var publicRooms = await _context.Rooms
            .ToListAsync();

        if (string.IsNullOrWhiteSpace(query))
        {
            return publicRooms.Take(50);
        }

        var scoredRooms = publicRooms
            .Select(r => new { Room = r, Score = Fuzz.WeightedRatio(query.ToLower(), r.Name.ToLower()) })
            .Where(x => x.Score >= 50)
            .OrderByDescending(x => x.Score)
            .Take(20)
            .Select(x => x.Room);

        return scoredRooms;
    }
}
