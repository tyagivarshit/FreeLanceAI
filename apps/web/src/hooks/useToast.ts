import { useState, useCallback } from "react";

export interface ToastState {
  message: string;
  isError: boolean;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    isError: false,
    visible: false,
  });

  const showToast = useCallback((message: string, isError = false, duration = 4000) => {
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
