using MeetingTime.Domain.Data;
using MeetingTime.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Shared.Domain.Interfaces;

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
}
