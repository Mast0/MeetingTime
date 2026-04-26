import { jwtDecode } from "jwt-decode";
import React, { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserWithToken } from "../api/auth";

interface AuthContextType {
    token: string | null;
    userName: string | null;
    userId: string | null;
    login: (token: string) => void;
    logout: () => void;
}

interface TokenPayload {
    sub: string;
    email: string;
    exp: number;
}

export const AuthContext = createContext<AuthContextType>({
    token: null,
    userName: null,
    userId: null,
    login: () => { },
    logout: () => { },
});

function isTokenExpired(token: string): boolean {
    try {
        const { exp } = jwtDecode<TokenPayload>(token);
        return Date.now() >= exp * 1000;
    } catch {
        return true;
    }
}

function getStoredToken(): string | null {
    const token = localStorage.getItem('token');
    if (token && isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        return null;
    }
    return token;
}

function getUserIdFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
        const { sub } = jwtDecode<TokenPayload>(token);
        return sub;
    } catch {
        return null;
    }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(getStoredToken);
    const [userName, setUserName] = useState<string | null>(localStorage.getItem('userName'));
    const userId = getUserIdFromToken(token);
    const navigate = useNavigate();

    // Sync token to localStorage
    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('userName');
            setUserName(null);
        }
    }, [token]);

    // Sync userName to localStorage
    useEffect(() => {
        if (userName) {
            localStorage.setItem('userName', userName);
        }
    }, [userName]);

    const login = useCallback(async (newToken: string) => {
        setToken(newToken);

        try {
            const payload = jwtDecode<TokenPayload>(newToken);
            const user = await getUserWithToken({ id: payload.sub }, newToken);
            setUserName(user.userName);
        } catch (err) {
            console.error('Get user name error', err);
            setUserName(null);
        }

        navigate('/');
    }, [navigate]);

    const logout = useCallback(() => {
        setToken(null);
        navigate('/login');
    }, [navigate]);

    return (
        <AuthContext.Provider value={{ token, userName, userId, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};