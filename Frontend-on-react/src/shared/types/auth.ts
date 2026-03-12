export type UserRole = 'Manager' | 'Admin' | 'SuperAdmin';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
  refreshToken: string;
}
