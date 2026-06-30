// ============================================================
// 🎨 src/kernel/auth-context.jsx
// SUPREME Auth Context — Universal Authentication State
// ============================================================
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check existing session on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('supreme_access_token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await api.auth.verify();
            setUser(response.data.user);
            setIsAuthenticated(true);
        } catch (error) {
            localStorage.removeItem('supreme_access_token');
            localStorage.removeItem('supreme_refresh_token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (credentials) => {
        const response = await api.auth.login(credentials);
        const { accessToken, refreshToken, identity } = response.data;

        localStorage.setItem('supreme_access_token', accessToken);
        localStorage.setItem('supreme_refresh_token', refreshToken);

        setUser(identity);
        setIsAuthenticated(true);

        return identity;
    };

    const loginWithProvider = (provider) => {
        const redirectUri = `${window.location.origin}/auth/callback`;
        const authUrl = `${import.meta.env.VITE_API_URL}/api/auth/${provider}?redirect_uri=${redirectUri}`;
        window.location.href = authUrl;
    };

    const register = async (data) => {
        const response = await api.auth.register(data);
        return response.data;
    };

    const logout = async () => {
        try {
            await api.auth.logout();
        } catch (error) {
            // Ignore logout errors
        } finally {
            localStorage.removeItem('supreme_access_token');
            localStorage.removeItem('supreme_refresh_token');
            setUser(null);
            setIsAuthenticated(false);
            window.location.href = '/login';
        }
    };

    const refreshToken = async () => {
        const refreshToken = localStorage.getItem('supreme_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await api.auth.refreshToken(refreshToken);
        localStorage.setItem('supreme_access_token', response.data.accessToken);
        return response.data.accessToken;
    };

    const linkProvider = async (provider) => {
        const response = await api.identity.linkProvider(provider);
        return response.data;
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        loginWithProvider,
        register,
        logout,
        refreshToken,
        linkProvider,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export default AuthContext;
