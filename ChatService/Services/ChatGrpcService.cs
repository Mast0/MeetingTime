using Grpc.Core;
using Protos;
using Shared.Domain.Interfaces;
using static Protos.Chat;
using ChatService.Services;

namespace ChatService.Services;

public class ChatGrpcService : ChatBase
{
    private const int DefaultPageSize = 30;

    private readonly IChatMessageRepository _repo;
    private readonly Auth.AuthClient _authClient;
    private readonly IAesEncryptionService _encryption;

    public ChatGrpcService(
        IChatMessageRepository repo,
        Auth.AuthClient authClient,
        IAesEncryptionService encryption)
    {
        _repo       = repo;
        _authClient = authClient;
        _encryption = encryption;
    }

    public override async Task<MessagesResponse> GetMessages(MessagesRequest request, ServerCallContext context)
    {
        if (string.IsNullOrEmpty(request.RoomId))
            return new MessagesResponse();

        var pageSize = request.PageSize > 0 ? request.PageSize : DefaultPageSize;

        // BeforeTimestamp == 0 means "start from now" (initial load)
        DateTimeOffset? before = request.BeforeTimestamp > 0
            ? DateTimeOffset.FromUnixTimeMilliseconds(request.BeforeTimestamp)
            : null;

        var (messageEntities, hasMore) = await _repo.ListByRoomPagedAsync(
            request.RoomId, before, pageSize);

        var entityList = messageEntities.ToList();

        var usersReq = new UsersRequest();
        usersReq.Ids.AddRange(entityList.Select(x => x.UserId).Distinct());

        var usrNamesDict = (await _authClient.GetUsersByIdsAsync(usersReq))
            .Users_
            .ToDictionary(k => k.Id, v => v.UserName);

        var messages = entityList.Select(m =>
        {
            string plaintext;
            try
            {
                plaintext = _encryption.Decrypt(m.Text);
            }
            catch
            {
                // Fallback for any legacy plaintext rows that pre-date encryption
                plaintext = m.Text;
            }

            return new Message
            {
                UserId    = m.UserId,
                UserName  = usrNamesDict.GetValueOrDefault(m.UserId) ?? "Unknown",
                RoomId    = m.RoomId.ToString(),
                Text      = plaintext,
                Timestamp = m.Timestamp.ToUnixTimeMilliseconds(),
            };
        });

        var response = new MessagesResponse { HasMore = hasMore };
        response.Messages.AddRange(messages);
        return response;
    }
}
