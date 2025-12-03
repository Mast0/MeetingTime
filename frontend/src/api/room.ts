import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL + '/room',
    headers: {
        'ngrok-skip-browser-warning': 'true'
    }
});

api.interceptors.request.use((conf) => {
    const token = localStorage.getItem('token');
    if (token)
        conf.headers.Authorization = `Bearer ${token}`;

    return conf;
});

export const getRooms = async () => {
    const response = await api.get('/');
    return response.data;
};

export const createRoom = async (data: { name: string; maxParticipiants: number, password: string }) => {
    const response = await api.post('/', data);
    return response.data;
};