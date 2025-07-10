import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL + '/auth',
});

export const register = async (data: { username: string; email: string; password: string }) => {
    const response = await api.post('/register', data)
    return response.data;
};

export const login = async (data: { email: string; password: string }) => {
    const response = await api.post('/login', data)
    return response.data;
}