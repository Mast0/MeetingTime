using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using StackExchange.Redis;
using System.Text.Json;

namespace ChatService.Repositories;

public class ChatMessageRepository : IChatMessageRepository
{
    private static readonly TimeSpan LatestPageTtl = TimeSpan.FromSeconds(60);
    private static readonly JsonSerializerOptions JsonOpt = new() { PropertyNameCaseInsensitive = true };

    private readonly MeetingTimeContext _context;
    private readonly IDatabase _redis;

    public ChatMessageRepository(MeetingTimeContext context, IConnectionMultiplexer redis)
    {
        _context = context;
        _redis   = redis.GetDatabase();
    }

    public async Task AddAsync(ChatMessageEntity msg)
    {
        await _context.ChatMessages.AddAsync(msg);
        await _context.SaveChangesAsync();

        // Invalidate the latest-page cache for this room so the next load is fresh
        await _redis.KeyDeleteAsync(LatestPageKey(msg.RoomId.ToString()));
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

    public async Task<(IEnumerable<ChatMessageEntity> Messages, bool HasMore)> ListByRoomPagedAsync(
        string roomId,
        DateTimeOffset? before,
        int pageSize)
    {
        if (!Guid.TryParse(roomId, out var guid))
            return (Enumerable.Empty<ChatMessageEntity>(), false);

        // Cache only the initial page (before == null) — it is by far the most-read query
        if (before == null)
        {
            var cacheKey = LatestPageKey(roomId);
            var cached   = await _redis.StringGetAsync(cacheKey);

            if (cached.HasValue)
            {
                var hit = JsonSerializer.Deserialize<CachedPage>(cached!, JsonOpt)!;
                return (hit.Messages, hit.HasMore);
            }

            var (messages, hasMore) = await QueryPagedAsync(guid, before: null, pageSize);

            // Store in Redis for 60 s
            var payload = JsonSerializer.Serialize(new CachedPage(messages, hasMore), JsonOpt);
            await _redis.StringSetAsync(cacheKey, payload, LatestPageTtl);

            return (messages, hasMore);
        }

        return await QueryPagedAsync(guid, before, pageSize);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<(List<ChatMessageEntity> Messages, bool HasMore)> QueryPagedAsync(
        Guid roomId, DateTimeOffset? before, int pageSize)
    {
        var query = _context.ChatMessages.Where(m => m.RoomId == roomId);

        if (before.HasValue)
            query = query.Where(m => m.Timestamp < before.Value);

        var rows    = await query.OrderByDescending(m => m.Timestamp).Take(pageSize + 1).ToListAsync();
        var hasMore = rows.Count > pageSize;
        var page    = rows.Take(pageSize).OrderBy(m => m.Timestamp).ToList();

        return (page, hasMore);
    }

    private static string LatestPageKey(string roomId) => $"chat:room:{roomId}:latest";

    /// <summary>Cached payload stored in Redis for the latest message page.</summary>
    private sealed record CachedPage(List<ChatMessageEntity> Messages, bool HasMore);
}
