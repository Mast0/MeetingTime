using MeetingTime.Domain.Entities;

namespace Shared.Domain.Interfaces;

public interface IRoomRepository
{
    Task<RoomEntity?> GetByIdAsync(Guid id);
    Task<IEnumerable<RoomEntity>> ListAsync();
    Task<RoomEntity> AddAsync(RoomEntity room);
    Task<RoomEntity> UpdateAsync(RoomEntity room);
    Task DeleteAsync(Guid id);
}
