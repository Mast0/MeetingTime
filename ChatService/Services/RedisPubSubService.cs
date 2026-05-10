using ChatService.Models;
using StackExchange.Redis;
using System.Text.Json;

namespace ChatService.Services;

/// <summary>
/// Wraps Redis Pub/Sub for chat room fan-out.
/// Channel naming: <c>chat:room:{roomId}</c>
/// </summary>
public sealed class RedisPubSubService : IRedisPubSubService
{
    private readonly ISubscriber _subscriber;

    private static readonly JsonSerializerOptions JsonOpt = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public RedisPubSubService(IConnectionMultiplexer redis)
    {
        _subscriber = redis.GetSubscriber();
    }

    public async Task PublishAsync(string roomId, ChatMessagePayload payload)
    {
        var channel  = Channel(roomId);
        var json     = JsonSerializer.Serialize(payload, JsonOpt);
        await _subscriber.PublishAsync(channel, json);
    }

    public async Task SubscribeAsync(string roomId, Func<ChatMessagePayload, Task> onMessage)
    {
        var channel = Channel(roomId);

        await _subscriber.SubscribeAsync(channel, async (_, message) =>
        {
            if (message.IsNullOrEmpty) return;

            try
            {
                var payload = JsonSerializer.Deserialize<ChatMessagePayload>(message!, JsonOpt);
                if (payload != null)
                    await onMessage(payload);
            }
            catch
            {
                // Malformed message — ignore
            }
        });
    }

    public async Task UnsubscribeAsync(string roomId)
    {
        await _subscriber.UnsubscribeAsync(Channel(roomId));
    }

    private static RedisChannel Channel(string roomId) =>
        new($"chat:room:{roomId}", RedisChannel.PatternMode.Literal);
}
