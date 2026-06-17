export interface User {
  id: number;
  username: string;
  role: 'admin' | 'employee';
  name: string;
}

const mockUsers: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin123',
    user: { id: 1, username: 'admin', role: 'admin', name: '管理员' },
  },
  zhangsan: {
    password: 'user123',
    user: { id: 2, username: 'zhangsan', role: 'employee', name: '张三' },
  },
};

export const auth = {
  login: (username: string, password: string): Promise<{ token: string; user: User }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const record = mockUsers[username];
        if (record && record.password === password) {
          const token = `token-${username}-${Date.now()}`;
          resolve({ token, user: record.user });
        } else {
          reject(new Error('用户名或密码错误'));
        }
      }, 500);
    });
  },

  saveToken: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },
};
