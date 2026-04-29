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