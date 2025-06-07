using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;

namespace ChatService.Repositories;

public class ChatMessageRepository : IChatMessageRepository
{
    private readonly MeetingTimeContext _context;

    public ChatMessageRepository(MeetingTimeContext context)
    {
        _context = context;
    }

    public async Task AddAsync(ChatMessageEntity msg)
    {
        await _context.ChatMessages.AddAsync(msg);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<ChatMessageEntity>> ListByRoomAsync(string roomId)
    {
        if (Guid.TryParse(roomId, out var guid))
        {
            return await _context.ChatMessages
            .Where(m => m.RoomId == guid)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
        }
        return new List<ChatMessageEntity>();
    }
}
