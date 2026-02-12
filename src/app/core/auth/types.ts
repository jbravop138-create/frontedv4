export type Role = 'admin' | 'user';

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user: {
    id: string;
    full_name: string;
    role: Role;
    email: string;
  };
}