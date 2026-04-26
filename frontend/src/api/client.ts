import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'ngrok-skip-browser-warning': 'true'
    }
});

apiClient.interceptors.request.use((conf) => {
    const token = localStorage.getItem('token');
    if (token)
        conf.headers.Authorization = `Bearer ${token}`;
    return conf;
});

export default apiClient;
