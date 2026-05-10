import apiClient from "./client";

export const getMessages = async (params: {
    roomId: string;
    beforeTimestamp?: number;
    pageSize?: number;
}) => {
    const response = await apiClient.get(
        `/chat/rooms/${params.roomId}/messages`,
        {
            params: {
                beforeTimestamp: params.beforeTimestamp,
                pageSize: params.pageSize,
            },
        }
    );
    return response.data;
};