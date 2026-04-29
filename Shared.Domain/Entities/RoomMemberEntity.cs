using MeetingTime.Domain.Entities;
using System.ComponentModel.DataAnnotations.Schema;

namespace Shared.Domain.Entities;

public class RoomMemberEntity
{
    public Guid RoomId { get; set; }

    [ForeignKey(nameof(RoomId))]
    public RoomEntity Room { get; set; } = default!;

    public string UserId { get; set; } = default!;

    [ForeignKey(nameof(UserId))]
    public UserEntity User { get; set; } = default!;

    public string Role { get; set; } = "member"; // "owner" or "member"

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}
