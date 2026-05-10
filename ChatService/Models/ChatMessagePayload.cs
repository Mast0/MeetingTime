namespace ChatService.Models;

public class ChatMessagePayload
{
    /// <summary>"chat" | "join" | "leave" | "heartbeat"</summary>
    public string Type { get; set; } = "chat";
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public long Timestamp { get; set; }
}
