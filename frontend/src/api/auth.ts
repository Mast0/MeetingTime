import apiClient from "./client";

export const register = async (data: { username: string; email: string; password: string }): Promise<string> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data.token ?? response.data;
};

export const login = async (data: { email: string; password: string }): Promise<string> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data.token ?? response.data;
};

export const getUserWithToken = async (data: { id: string }, token: string) => {
    const response = await apiClient.post('/auth/user', data, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getUser = async (data: { id: string }) => {
    const response = await apiClient.post('/auth/user', data);
    return response.data;
};

export const searchUsers = async (query: string) => {
    const response = await apiClient.get('/auth/search', { params: { query } });
    return response.data;
};

export const guestLogin = async (data: { displayName: string; roomId: string }): Promise<{ token: string; displayName: string; guestId: string }> => {
    const response = await apiClient.post('/auth/guest', data);
    return response.data;
};

export const updateProfile = async (data: { username?: string; email?: string }): Promise<void> => {
    await apiClient.put('/auth/profile', data);
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.put('/auth/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
    });
};