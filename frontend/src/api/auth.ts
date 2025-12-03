import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL + '/auth',
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

export const register = async (data: { username: string; email: string; password: string }) => {
    const response = await api.post('/register', data);
    return response.data;
};

export const login = async (data: { email: string; password: string }) => {
    const response = await api.post('/login', data);
    return response.data;
}

export const getUserWithToken = async (data: { id: string }, token: string) => {
    const response = await api.post('/user', data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
};

export const getUser = async (data: { id: string }) => {
    const response = await api.post('/user', data);
    return response.data;
};