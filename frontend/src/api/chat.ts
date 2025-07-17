import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL + '/chat',
});

api.interceptors.request.use((conf) => {
    const token = localStorage.getItem('token');
    if (token)
        conf.headers.Authorization = `Bearer ${token}`;

    return conf;
});

export const getMessages = async (data: { RoomId: string }) => {
    const response = await api.post('/rooms', data);
    return response.data;
};