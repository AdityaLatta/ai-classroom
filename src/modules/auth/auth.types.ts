export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface LoginWithGoogleDTO {
  idToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}
