using MeetingTime.Domain.Entities;
using System.ComponentModel.DataAnnotations.Schema;

namespace Shared.Domain.Entities;

public class ChatMessageEntity
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    [ForeignKey(nameof(RoomId))]
    public RoomEntity Room { get; set; } = default!;
    public string UserId { get; set; }
    [ForeignKey(nameof(UserId))]
    public UserEntity Sender { get; set; } = default!;
    public string Text { get; set; } = default!;
    public DateTimeOffset Timestamp { get; set; }
}
