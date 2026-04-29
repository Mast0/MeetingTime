using MeetingTime.Domain.Entities;
using Shared.Domain.Entities;

namespace Shared.Domain.Interfaces;

public interface IRoomRepository
{
    Task<RoomEntity?> GetByIdAsync(Guid id);
    Task<IEnumerable<RoomEntity>> ListAsync();
    Task<RoomEntity> AddAsync(RoomEntity room);
    Task<RoomEntity> UpdateAsync(RoomEntity room);
    Task DeleteAsync(Guid id);

    // Membership
    Task AddMemberAsync(Guid roomId, string userId, string role);
    Task RemoveMemberAsync(Guid roomId, string userId);
    Task<IEnumerable<RoomEntity>> ListByUserAsync(string userId);
    Task<IEnumerable<RoomMemberEntity>> GetMembersAsync(Guid roomId);
    Task<bool> IsMemberAsync(Guid roomId, string userId);

    // Search
    Task<IEnumerable<RoomEntity>> SearchPublicRoomsAsync(string query);
}
