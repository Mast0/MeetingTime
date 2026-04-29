using Microsoft.AspNetCore.Identity;

namespace Shared.Domain.Entities;

public class UserEntity : IdentityUser
{
    public ICollection<ChatMessageEntity> SetMessages { get; set; } = new List<ChatMessageEntity>();
    public ICollection<RoomMemberEntity> RoomMemberships { get; set; } = new List<RoomMemberEntity>();
}
