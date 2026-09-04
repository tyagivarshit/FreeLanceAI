export interface User {
  id?: string;
  userId?: string;
  email: string;
  createdAt?: string;
  status?: string;
}

export interface SessionResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface SignupResponse {
  success: boolean;
  user?: User;
  verificationTriggered?: boolean;
  error?: string;
  code?: string;
  errors?: string[];
  message?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  verificationTriggered?: boolean;
  error?: string;
  code?: string;
  message?: string;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
}
