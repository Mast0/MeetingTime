namespace ChatService.Services;

/// <summary>
/// Tracks per-user online presence using Redis keys with TTL.
/// Key pattern: presence:{userId}  TTL: 60 s (refreshed by heartbeats).
/// </summary>
public interface IPresenceService
{
    /// <summary>Set a user online by writing/refreshing a Redis TTL key.</summary>
    Task SetOnlineAsync(string userId);

    /// <summary>Remove the Redis key immediately (user disconnected).</summary>
    Task SetOfflineAsync(string userId);

    /// <summary>Return which of the given userIds currently have an active presence key.</summary>
    Task<IReadOnlyList<string>> GetOnlineUsersAsync(IEnumerable<string> userIds);
}
