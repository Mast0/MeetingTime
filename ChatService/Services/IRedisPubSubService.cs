using ChatService.Models;

namespace ChatService.Services;

public interface IRedisPubSubService
{
    /// <summary>
    /// Publishes a chat message payload to the Redis channel for the given room.
    /// All ChatService instances subscribed to that room will forward it to their local sockets.
    /// </summary>
    Task PublishAsync(string roomId, ChatMessagePayload payload);

    /// <summary>
    /// Subscribes to Redis messages for <paramref name="roomId"/> and invokes
    /// <paramref name="onMessage"/> for each received payload.
    /// Safe to call multiple times — StackExchange.Redis deduplicates channel subscriptions.
    /// </summary>
    Task SubscribeAsync(string roomId, Func<ChatMessagePayload, Task> onMessage);

    /// <summary>
    /// Removes the subscription for the given room channel when the last local socket leaves.
    /// </summary>
    Task UnsubscribeAsync(string roomId);
}
