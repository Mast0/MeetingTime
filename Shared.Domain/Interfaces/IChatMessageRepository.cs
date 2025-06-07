using Shared.Domain.Entities;

namespace Shared.Domain.Interfaces;

public interface IChatMessageRepository
{
    Task AddAsync(ChatMessageEntity msg);
    Task<IEnumerable<ChatMessageEntity>> ListByRoomAsync(string roomId);
}
