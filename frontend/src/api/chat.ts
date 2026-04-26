import apiClient from "./client";

export const getMessages = async (data: { RoomId: string }) => {
    const response = await apiClient.post('/chat/rooms', data);
    return response.data;
};