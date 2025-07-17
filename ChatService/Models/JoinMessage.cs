namespace ChatService.Models;

public class JoinMessage
{
    public string UserId { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string Text => "__join__";
    public long Timestamp => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public ChatMessagePayload ToChatMsg() => new ChatMessagePayload()
    {
        UserId = UserId,
        RoomId = RoomId,
        Text = Text,
        Timestamp = Timestamp
    };
}
