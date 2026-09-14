import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { authService } from "../services/authService.js";
export const AuthContext = createContext({
    user: null,
    loading: true,
    isAuthenticated: false,
    refreshUser: async () => { },
    logout: async () => { },
});
export function useAuth() {
    return useContext(AuthContext);
}
export function useAuthProvider() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const refreshUser = useCallback(async () => {
        try {
            const res = await authService.getSession();
            if (res.success && res.user) {
                setUser(res.user);
            }
            else {
                setUser(null);
            }
        }
        catch {
            setUser(null);
        }
        finally {
            setLoading(false);
        }
    }, []);
    const logout = useCallback(async (global = false) => {
        try {
            await authService.logout({ global });
        }
        finally {
            setUser(null);
            window.location.href = "/login.html";
        }
    }, []);
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);
    return {
        user,
        loading,
        isAuthenticated: Boolean(user),
        refreshUser,
        logout,
    };
}
