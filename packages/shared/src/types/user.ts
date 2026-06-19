export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  influencerCode?: string;
  referredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  referralCode?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}
