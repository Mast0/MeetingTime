using Grpc.Core;
using Protos;
using Shared.Domain.Interfaces;
using static Protos.Chat;

namespace ChatService.Services;

public class ChatGrpcService : ChatBase
{
    private readonly IChatMessageRepository _repo;
    private readonly Auth.AuthClient _authClient;

    public ChatGrpcService(IChatMessageRepository repo, Auth.AuthClient authClient)
    {
        _repo = repo;
        _authClient = authClient;
    }

    public override async Task<MessagesResponse> GetMessages(MessagesRequest request, ServerCallContext context)
    {
        if (string.IsNullOrEmpty(request.RoomId))
            return new MessagesResponse();

        var messageEntities = await _repo.ListByRoomAsync(request.RoomId);


        var usersReq = new UsersRequest();
        usersReq.Ids.AddRange(messageEntities.Select(x => x.UserId).Distinct());

        var usrNamesDict = (await _authClient.GetUsersByIdsAsync(usersReq)).Users_.ToDictionary(k => k.Id, v => v.UserName);

        var messages = messageEntities.Select(m => new Message
        {
            UserId = m.UserId,
            UserName = usrNamesDict[m.UserId] ?? "Unknown",
            RoomId = m.RoomId.ToString(),
            Text = m.Text,
            Timestamp = m.Timestamp.ToUnixTimeMilliseconds(),
        });

        var response = new MessagesResponse();
        response.Messages.AddRange(messages);
        return response;
    }
}
