import type { User } from '../types';

const KEYS = {
  TOKEN_KEY: 'asset_token',
  USER_KEY: 'asset_user',
};

export const setAuth = (token: string, user: User): void => {
  localStorage.setItem(KEYS.TOKEN_KEY, token);
  localStorage.setItem(KEYS.USER_KEY, JSON.stringify(user));
};

export const getToken = (): string | null => {
  return localStorage.getItem(KEYS.TOKEN_KEY);
};

export const getUser = (): User | null => {
  const userStr = localStorage.getItem(KEYS.USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const clearAuth = (): void => {
  localStorage.removeItem(KEYS.TOKEN_KEY);
  localStorage.removeItem(KEYS.USER_KEY);
};

export const isAdmin = (): boolean => {
  const user = getUser();
  return user?.role === 'admin';
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};
