import apiClient from "./client";

export const getRooms = async () => {
    const response = await apiClient.get('/room/');
    return response.data;
};

export const getMyRooms = async () => {
    const response = await apiClient.get('/room/my');
    return response.data;
};

export const createRoom = async (data: { name: string; maxParticipiants: number; password: string }) => {
    const response = await apiClient.post('/room/', data);
    return response.data;
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