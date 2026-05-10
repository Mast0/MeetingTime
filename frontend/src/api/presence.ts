import apiClient from "./client";

/**
 * Returns which of the given user IDs are currently online.
 * Calls GET /api/presence?userIds=id1&userIds=id2&...
 */
export const getPresence = async (userIds: string[]): Promise<string[]> => {
    if (userIds.length === 0) return [];
    const params = new URLSearchParams();
    userIds.forEach(id => params.append('userIds', id));
    const response = await apiClient.get(`/presence?${params.toString()}`);
    return response.data.onlineUserIds ?? [];
};
