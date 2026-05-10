using StackExchange.Redis;

namespace ChatService.Services;

/// <summary>
/// Redis-backed presence tracking.
/// Each online user has a key  presence:{userId}  that expires after 60 s.
/// The frontend sends a "heartbeat" WebSocket message every 30 s to refresh it.
/// </summary>
public sealed class PresenceService : IPresenceService
{
    private const int TtlSeconds = 60;

    private readonly IDatabase _db;

    public PresenceService(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public Task SetOnlineAsync(string userId)
    {
        if (string.IsNullOrEmpty(userId)) return Task.CompletedTask;
        return _db.StringSetAsync(Key(userId), 1, TimeSpan.FromSeconds(TtlSeconds));
    }

    public Task SetOfflineAsync(string userId)
    {
        if (string.IsNullOrEmpty(userId)) return Task.CompletedTask;
        return _db.KeyDeleteAsync(Key(userId));
    }

    public async Task<IReadOnlyList<string>> GetOnlineUsersAsync(IEnumerable<string> userIds)
    {
        var ids = userIds.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
        if (ids.Count == 0) return Array.Empty<string>();

        // Batch existence check via pipeline
        var batch = _db.CreateBatch();
        var tasks = ids.Select(id => batch.KeyExistsAsync(Key(id))).ToList();
        batch.Execute();

        var results = await Task.WhenAll(tasks);

        var online = new List<string>();
        for (int i = 0; i < ids.Count; i++)
        {
            if (results[i]) online.Add(ids[i]);
        }
        return online;
    }

    private static string Key(string userId) => $"presence:{userId}";
}
