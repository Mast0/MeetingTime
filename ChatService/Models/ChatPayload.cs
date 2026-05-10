namespace ChatService.Models
{
    public class ChatPayload
    {
        /// <summary>"chat" | "heartbeat"</summary>
        public string Type { get; set; } = "chat";
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string RoomId { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public long Timestamp { get; set; }

        public ChatMessagePayload ToChatMsg() => new()
        {
            Type     = Type,
            UserId   = UserId,
            UserName = UserName,
            RoomId   = RoomId,
            Text     = Text,
            Timestamp = Timestamp
        };
    }
}
