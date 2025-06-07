using Grpc.Core;
using Protos;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using System.Collections.Concurrent;

namespace ChatService.Services;

public class ChatGrpcService : Chat.ChatBase
{
    private readonly IChatMessageRepository _repo;
    private static readonly ConcurrentDictionary<string, ConcurrentBag<IServerStreamWriter<ChatMessage>>> _rooms = new();

    public ChatGrpcService(IChatMessageRepository repo)
    {
        _repo = repo;
    }

    public override async Task Chat(
        IAsyncStreamReader<ChatMessage> requestStream,
        IServerStreamWriter<ChatMessage> responseStream, 
        ServerCallContext context)
    {
        if (!await requestStream.MoveNext()) return;
        var first = requestStream.Current;
        var roomId = first.RoomId;

        // Add StreamWriter
        var bag = _rooms.GetOrAdd(roomId, 
            _ => new ConcurrentBag<IServerStreamWriter<ChatMessage>>());
        bag.Add(responseStream);

        // Broadcast function + save
        async Task BroadcasAndSave(ChatMessage msg)
        {
            await _repo.AddAsync(new ChatMessageEntity
            {
                Id = Guid.NewGuid(),
                RoomId = Guid.Parse(msg.RoomId),
                UserId = msg.UserId,
                Text = msg.Text,
                Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(msg.Timestamp)
            });

            foreach (var sub in bag)
            {
                try { await sub.WriteAsync(msg); }
                catch { /* Ignoring */ }
            }
        }

        await BroadcasAndSave(first);

        await foreach (var msg in requestStream.ReadAllAsync())
        {
            await BroadcasAndSave(msg);
        }
    }
}
