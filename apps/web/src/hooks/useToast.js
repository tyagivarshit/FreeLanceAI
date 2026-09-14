import { useState, useCallback } from "react";
export function useToast() {
    const [toast, setToast] = useState({
        message: "",
        isError: false,
        visible: false,
    });
    const showToast = useCallback((message, isError = false, duration = 4000) => {
        setToast({ message, isError, visible: true });
        setTimeout(() => {
            setToast((prev) => (prev.message === message ? { ...prev, visible: false } : prev));
        }, duration);
    }, []);
    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, visible: false }));
    }, []);
    return { toast, showToast, hideToast };
}
