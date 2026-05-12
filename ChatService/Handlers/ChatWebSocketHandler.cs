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
        string userId = null!;

        try
        {
            var buffer  = new byte[8192];
            var segment = new ArraySegment<byte>(buffer);

            // First message: join handshake
            var result = await ws.ReceiveAsync(segment, CancellationToken.None);
            var text   = Encoding.UTF8.GetString(buffer, 0, result.Count);
            var join   = JsonSerializer.Deserialize<JoinMessage>(text, JsonOpt)!;
            roomId     = join.RoomId;
            userId     = join.UserId;

            var repo      = ctx.RequestServices.GetRequiredService<IChatMessageRepository>();
            var encryption = ctx.RequestServices.GetRequiredService<IAesEncryptionService>();
            var pubSub    = ctx.RequestServices.GetRequiredService<IRedisPubSubService>();
            var presence  = ctx.RequestServices.GetRequiredService<IPresenceService>();

            // Register socket in the local room bucket
            var newBag = new ConcurrentDictionary<WebSocket, byte>();
            var bag = _rooms.GetOrAdd(roomId, newBag);
            bool isFirst = ReferenceEquals(bag, newBag);
            
            bag.TryAdd(ws, 1);

            // Mark user as online
            await presence.SetOnlineAsync(userId);

            // Only subscribe to Redis if this is the first local connection for this room
            if (isFirst)
            {
                await pubSub.SubscribeAsync(roomId, async payload =>
                {
                    if (_rooms.TryGetValue(roomId, out var currentBag))
                    {
                        await SendToLocalSocketsAsync(payload, currentBag);
                    }
                });
            }

            // Broadcast join notification via Redis (reaches all instances)
            await pubSub.PublishAsync(roomId, join.ToChatMsg());

            // Main receive loop
            while (!result.CloseStatus.HasValue)
            {
                result = await ws.ReceiveAsync(segment, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                text       = Encoding.UTF8.GetString(buffer, 0, result.Count);
                var chat   = JsonSerializer.Deserialize<ChatPayload>(text, JsonOpt)!;

                // Heartbeat: refresh TTL, do NOT broadcast or persist
                if (string.Equals(chat.Type, "heartbeat", StringComparison.OrdinalIgnoreCase))
                {
                    await presence.SetOnlineAsync(userId);
                    continue;
                }

                var chatMsg = chat.ToChatMsg();

                // Persist encrypted message, invalidate cache, then publish plaintext via Redis
                await PersistAsync(chatMsg, ctx.RequestServices, encryption);
                await pubSub.PublishAsync(roomId, chatMsg);
            }

            // Cleanup
            bag.TryRemove(ws, out _);
            if (bag.IsEmpty)
            {
                _rooms.TryRemove(roomId, out _);
                await pubSub.UnsubscribeAsync(roomId);
            }

            await presence.SetOfflineAsync(userId);

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

            if (userId != null)
            {
                var presence = ctx.RequestServices.GetService<IPresenceService>();
                if (presence != null) await presence.SetOfflineAsync(userId);
            }
        }
    }

    /// <summary>
    /// Persists a real chat message with encrypted text to the database.
    /// Uses a separate scope so DbContext failures (e.g. guest foreign key violations)
    /// don't corrupt the long-running WebSocket scope or crash the connection.
    /// </summary>
    private static async Task PersistAsync(
        ChatMessagePayload msg,
        IServiceProvider services,
        IAesEncryptionService encryption)
    {
        try
        {
            var encryptedText = encryption.Encrypt(msg.Text);

            using var scope = services.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IChatMessageRepository>();

            await repo.AddAsync(new ChatMessageEntity
            {
                Id        = Guid.NewGuid(),
                RoomId    = Guid.Parse(msg.RoomId),
                UserId    = msg.UserId,
                Text      = encryptedText,
                Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(msg.Timestamp),
            });
        }
        catch (Exception ex)
        {
            Serilog.Log.Warning(ex, "Failed to persist chat message (UserId: {UserId}). This is expected for guest users.", msg.UserId);
        }
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
