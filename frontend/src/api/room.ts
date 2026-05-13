import apiClient from "./client";

export const getRooms = async () => {
    const response = await apiClient.get('/room/');
    return response.data;
};

export const getRoomById = async (roomId: string, token?: string) => {
    const config: any = { params: { roomId } };
    if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
    }
    const response = await apiClient.get('/room/get-room', config);
    return response.data;
};

export const getRoomBasicInfo = async (roomId: string) => {
    const response = await apiClient.get(`/room/public/${roomId}/basic-info`);
    return response.data;
};

export const getMyRooms = async () => {
    const response = await apiClient.get('/room/my');
    return response.data;
};

export const createRoom = async (data: { name: string; password: string }) => {
    const response = await apiClient.post('/room/', data);
    return response.data;
};

export const checkRoomPassword = async (roomId: string, password: string) => {
    const response = await apiClient.post(`/room/${roomId}/check-password`, { password });
    return response.data as { valid: boolean };
};

export const addRoomMember = async (roomId: string, userId: string) => {
    const response = await apiClient.post(`/room/${roomId}/members`, { userId });
    return response.data;
};

export const removeRoomMember = async (roomId: string, userId: string) => {
    const response = await apiClient.delete(`/room/${roomId}/members/${userId}`);
    return response.data;
};

export const getRoomMembers = async (roomId: string) => {
    const response = await apiClient.get(`/room/${roomId}/members`);
    return response.data;
};

export const searchPublicRooms = async (query: string = '') => {
    const response = await apiClient.get(`/room/public/search`, { params: { query } });
    return response.data;
};