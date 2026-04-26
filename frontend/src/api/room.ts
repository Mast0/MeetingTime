import apiClient from "./client";

export const getRooms = async () => {
    const response = await apiClient.get('/room/');
    return response.data;
};

export const createRoom = async (data: { name: string; maxParticipiants: number; password: string }) => {
    const response = await apiClient.post('/room/', data);
    return response.data;
};