using Shared.Domain.Entities;

namespace MeetingTime.Domain.Entities;

public class RoomEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Password { get; set; }

    public ICollection<ChatMessageEntity> ChatMessages { get; set; } = new List<ChatMessageEntity>();
    public ICollection<RoomMemberEntity> Members { get; set; } = new List<RoomMemberEntity>();
}
