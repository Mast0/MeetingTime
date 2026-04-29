using Shared.Domain.Entities;

namespace Shared.Domain.Interfaces;

public interface IChatMessageRepository
{
    Task AddAsync(ChatMessageEntity msg);
    Task<IEnumerable<ChatMessageEntity>> ListByRoomAsync(string roomId);

    /// <summary>
    /// Returns up to <paramref name="pageSize"/> messages for the room,
    /// all older than <paramref name="before"/> (exclusive).
    /// Pass <c>null</c> for <paramref name="before"/> to get the most recent page.
    /// <paramref name="hasMore"/> is <c>true</c> when there are still older messages.
    /// </summary>
    Task<(IEnumerable<ChatMessageEntity> Messages, bool HasMore)> ListByRoomPagedAsync(
        string roomId,
        DateTimeOffset? before,
        int pageSize);
}
