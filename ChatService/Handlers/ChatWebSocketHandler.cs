using ChatService.Models;
using ChatService.Services;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace ChatService.Handlers;

public static class ChatWebSocketHandler
{
    // Per-instance local sockets only — cross-instance delivery is done via Redis Pub/Sub
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<WebSocket, byte>> _rooms = new();

    private static readonly JsonSerializerOptions JsonOpt = new()
    {
        PropertyNameCaseInsensitive = true,
        IncludeFields = true,
    };

    public static async Task Handle(HttpContext ctx)
    {
        if (!ctx.WebSockets.IsWebSocketRequest)
        {
            ctx.Response.StatusCode = 400;
            return;
        }

        var ws     = await ctx.WebSockets.AcceptWebSocketAsync();
        string roomId = null!;

        try
        {
            var buffer  = new byte[8192];
            var segment = new ArraySegment<byte>(buffer);

            // First message: join handshake
            var result = await ws.ReceiveAsync(segment, CancellationToken.None);
            var text   = Encoding.UTF8.GetString(buffer, 0, result.Count);
            var join   = JsonSerializer.Deserialize<JoinMessage>(text, JsonOpt)!;
            roomId     = join.RoomId;

            var repo       = ctx.RequestServices.GetRequiredService<IChatMessageRepository>();
            var encryption = ctx.RequestServices.GetRequiredService<IAesEncryptionService>();
            var pubSub     = ctx.RequestServices.GetRequiredService<IRedisPubSubService>();

            // Register socket in the local room bucket
            var bag = _rooms.GetOrAdd(roomId, _ => new());
            bag.TryAdd(ws, 1);

            // Subscribe to Redis channel (idempotent — SE.Redis deduplicates)
            await pubSub.SubscribeAsync(roomId, async payload =>
            {
                await SendToLocalSocketsAsync(payload, bag);
            });

            // Broadcast join notification via Redis (reaches all instances)
            await pubSub.PublishAsync(roomId, join.ToChatMsg());

            // Main receive loop
            while (!result.CloseStatus.HasValue)
            {
                result = await ws.ReceiveAsync(segment, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                text       = Encoding.UTF8.GetString(buffer, 0, result.Count);
                var chat   = JsonSerializer.Deserialize<ChatPayload>(text, JsonOpt)!;
                var chatMsg = chat.ToChatMsg();

                // Persist encrypted message, invalidate cache, then publish plaintext via Redis
                await PersistAsync(chatMsg, repo, encryption);
                await pubSub.PublishAsync(roomId, chatMsg);
            }

            // Cleanup
            bag.TryRemove(ws, out _);
            if (bag.IsEmpty)
            {
                _rooms.TryRemove(roomId, out _);
                await pubSub.UnsubscribeAsync(roomId);
            }

            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed", CancellationToken.None);
        }
        catch (Exception)
        {
            // Ensure cleanup on error
            if (roomId != null && _rooms.TryGetValue(roomId, out var bag))
            {
                bag.TryRemove(ws, out _);
                if (bag.IsEmpty)
                    _rooms.TryRemove(roomId, out _);
            }
        }
    }

    /// <summary>
    /// Persists a real chat message with encrypted text to the database.
    /// </summary>
    private static async Task PersistAsync(
        ChatMessagePayload msg,
        IChatMessageRepository repo,
        IAesEncryptionService encryption)
    {
        var encryptedText = encryption.Encrypt(msg.Text);

        await repo.AddAsync(new ChatMessageEntity
        {
            Id        = Guid.NewGuid(),
            RoomId    = Guid.Parse(msg.RoomId),
            UserId    = msg.UserId,
            Text      = encryptedText,
            Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(msg.Timestamp),
        });
    }

    /// <summary>
    /// Sends the payload JSON to all open WebSocket connections local to this instance.
    /// </summary>
    private static async Task SendToLocalSocketsAsync(
        ChatMessagePayload payload,
        ConcurrentDictionary<WebSocket, byte> bag)
    {
        var json    = JsonSerializer.Serialize(payload, JsonOpt);
        var data    = Encoding.UTF8.GetBytes(json);
        var segment = new ArraySegment<byte>(data);

        foreach (var sock in bag.Keys)
        {
            if (sock.State == WebSocketState.Open)
                await sock.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
