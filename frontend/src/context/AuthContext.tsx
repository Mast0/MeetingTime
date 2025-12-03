import { jwtDecode } from "jwt-decode";
import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserWithToken } from "../api/auth";

interface AuthContextType {
    token: string | null;
    userName: string | null;
    login: (token: string) => void;
    logout: () => void;
}

interface TokenPayload {
  sub: string;
  email: string;
}

export const AuthContext = createContext<AuthContextType>({
    token: null,
    userName: null,
    login: () => {},
    logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [userName, setUserName] = useState<string | null>(localStorage.getItem('userName'));
    const navigate = useNavigate();

    useEffect(() => {
        if (token) localStorage.setItem('token', token);
        else {
            localStorage.removeItem('token');
            setUserName(null);
            localStorage.removeItem('userName');
        }
    }, [token]);

    useEffect(() => {
        if (userName) {
            localStorage.setItem('userName', userName);
        }
    });

    const login = async (token: string) => {
        setToken(token);

        try {
            const payload = jwtDecode<TokenPayload>(token);
            const user = await getUserWithToken({ id: payload.sub }, token);
            setUserName(user.userName);
        } catch (err) {
            console.error('Get user name error', err);
            setUserName(null);
        }

        navigate('/');
    };
    const logout = () => {
        setToken(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ token, userName, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};