using ChatService.Models;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace ChatService.Handlers;

public static class ChatWebSocketHandler
{
    private static readonly ConcurrentDictionary<string, ConcurrentBag<WebSocket>> _rooms = new();

    public static async Task Handle(HttpContext ctx)
    {
        if (!ctx.WebSockets.IsWebSocketRequest)
        {
            ctx.Response.StatusCode = 400;
            return;
        }

        var opt = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            IncludeFields = true,
        };

        var ws = await ctx.WebSockets.AcceptWebSocketAsync();
        string roomId = null!;

        // Accept first message with JSON that have roomId and userId
        try
        {
            var buffer = new byte[8192];
            var segment = new ArraySegment<byte>(buffer);
            var result = await ws.ReceiveAsync(segment, CancellationToken.None);
            var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
            var join = JsonSerializer.Deserialize<JoinMessage>(text, opt)!;
            roomId = join.RoomId;

            // Add room
            var bag = _rooms.GetOrAdd(roomId, _ => new());
            bag.Add(ws);

            var repo = ctx.RequestServices.GetRequiredService<IChatMessageRepository>();

            // Sharing join message
            await BroadcastAndSave(opt, join.ToChatMsg(), bag, repo);

            // Read all new msg`s
            while (!result.CloseStatus.HasValue)
            {
                result = await ws.ReceiveAsync(segment, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                var chat = JsonSerializer.Deserialize<ChatPayload>(text, opt)!;

                await BroadcastAndSave(opt, chat.ToChatMsg(), bag, repo);
            }

            // User exit
            bag.TryTake(out _);
            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed", CancellationToken.None);
        } catch (Exception ex)
        {
            ctx.Response.StatusCode = 400;
            return;
        }
    }

    private static async Task BroadcastAndSave(
        JsonSerializerOptions opt,
        ChatMessagePayload msg,
        ConcurrentBag<WebSocket> bag,
        IChatMessageRepository repo)
    {
        // Save
        await repo.AddAsync(new ChatMessageEntity
        {
            Id = Guid.NewGuid(),
            RoomId = Guid.Parse(msg.RoomId),
            UserId = msg.UserId,
            Text = msg.Text,
            Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(msg.Timestamp),
        });

        var json = JsonSerializer.Serialize(msg, opt);
        var data = Encoding.UTF8.GetBytes(json);
        var segment = new ArraySegment<byte>(data);

        foreach (var sock in bag)
        {
            if (sock.State == WebSocketState.Open)
                await sock.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
