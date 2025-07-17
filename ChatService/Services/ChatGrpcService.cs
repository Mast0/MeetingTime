using Grpc.Core;
using Protos;
using Shared.Domain.Interfaces;
using static Protos.Chat;

namespace ChatService.Services;

public class ChatGrpcService : ChatBase
{
    private readonly IChatMessageRepository _repo;

    public ChatGrpcService(IChatMessageRepository repo)
    {
        _repo = repo;
    }

    public override async Task<MessagesResponse> GetMessages(MessagesRequest request, ServerCallContext context)
    {
        if (string.IsNullOrEmpty(request.RoomId))
            return new MessagesResponse();

        var messages = (await _repo.ListByRoomAsync(request.RoomId)).Select(m => new Message
        {
            UserId = m.UserId,
            RoomId = m.RoomId.ToString(),
            Text = m.Text,
            Timestamp = m.Timestamp.ToUnixTimeMilliseconds(),
        });

        var response = new MessagesResponse();
        response.Messages.AddRange(messages);
        return response;
    }
}
