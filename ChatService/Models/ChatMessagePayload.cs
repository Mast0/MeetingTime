namespace ChatService.Models;

public class ChatMessagePayload
{
    public string UserId { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public long Timestamp { get; set; }
}
