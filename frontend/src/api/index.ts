import axios from 'axios';
import { message } from 'antd';
import { getToken, clearAuth } from '../utils/auth';
import type {
  User,
  Asset,
  BorrowRequest,
  ReturnRecord,
  RepairRecord,
  InventoryTask,
  InventoryDetail,
} from '../types';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        clearAuth();
        message.error('登录已过期，请重新登录');
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      } else {
        const errorMsg = error.response.data?.message || '请求失败，请稍后重试';
        message.error(errorMsg);
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请检查网络');
    } else {
      message.error('网络错误，请稍后重试');
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (data: { username: string; password: string }) =>
    request.post<any, { token: string; user: User; message: string }>('/auth/login', data),
  getProfile: () => request.get<any, { user: User }>('/auth/profile'),
  getUsers: () => request.get<any, { users: User[] }>('/auth/users'),
};

export const assets = {
  list: (params?: Record<string, any>) =>
    request.get<any, { assets: Asset[]; total: number; page: number; pageSize: number }>('/assets', { params }),
  getCategories: () => request.get<any, { categories: string[] }>('/assets/categories'),
  getById: (id: number) => request.get<any, { asset: Asset }>(`/assets/${id}`),
  create: (data: Partial<Asset>) => request.post<any, { asset: Asset; message: string }>('/assets', data),
  update: (id: number, data: Partial<Asset>) =>
    request.put<any, { asset: Asset; message: string }>(`/assets/${id}`, data),
  remove: (id: number) => request.delete<any, { message: string }>(`/assets/${id}`),
};

export const borrowRequests = {
  list: (params?: Record<string, any>) =>
    request.get<any, { requests: BorrowRequest[]; total: number; page: number; pageSize: number }>('/borrow-requests', { params }),
  getPendingCount: () => request.get<any, { count: number }>('/borrow-requests/pending-count'),
  create: (data: { asset_id: number; purpose: string; expected_return_date?: string }) =>
    request.post<any, { request: BorrowRequest; message: string }>('/borrow-requests', data),
  approve: (id: number, data: { approval_comment?: string }) =>
    request.put<any, { request: BorrowRequest; message: string }>(`/borrow-requests/${id}/approve`, data),
  reject: (id: number, data: { approval_comment: string }) =>
    request.put<any, { request: BorrowRequest; message: string }>(`/borrow-requests/${id}/reject`, data),
};

export const returns = {
  returnAsset: (data: {
    borrow_request_id: number;
    return_status: 'good' | 'damaged' | 'lost';
    return_note?: string;
  }) => request.post<any, { returnRecord: ReturnRecord; message: string }>('/returns/return', data),
  getMyReturns: () => request.get<any, { records: ReturnRecord[] }>('/returns/my-returns'),
  getRepairRecords: (params?: Record<string, any>) =>
    request.get<any, { records: RepairRecord[]; total: number; page: number; pageSize: number }>('/returns/repair-records', { params }),
  updateRepair: (id: number, data: { status?: string; cost?: number; repair_note?: string }) =>
    request.put<any, { record: RepairRecord; message: string }>(`/returns/repair-records/${id}`, data),
};

export const inventory = {
  listTasks: (params?: Record<string, any>) =>
    request.get<any, { tasks: (InventoryTask & { creator_name?: string; total_count?: number; checked_count?: number })[]; total: number; page: number; pageSize: number }>('/inventory', { params }),
  getTaskDetails: (taskId: number, params?: Record<string, any>) =>
    request.get<any, {
      task: InventoryTask & { creator_name?: string; total_count?: number; checked_count?: number };
      details: (InventoryDetail & {
        asset_no?: string; asset_name?: string; category?: string;
        asset_status?: string; location?: string; net_value?: number; checker_name?: string;
      })[];
      total: number; page: number; pageSize: number;
    }>(`/inventory/${taskId}/details`, { params }),
  generateTask: (data: { year: number; quarter: string; deadline?: string }) =>
    request.post<any, { task: InventoryTask; detailCount: number; message: string }>('/inventory/generate', data),
  updateDetail: (
    taskId: number,
    detailId: number,
    data: { status: 'checked' | 'abnormal' | 'missing'; check_note?: string }
  ) => request.put<any, { detail: InventoryDetail; taskCompleted: boolean; message: string }>(
    `/inventory/${taskId}/details/${detailId}`, data
  ),
  completeTask: (taskId: number) =>
    request.put<any, { task: InventoryTask; message: string }>(`/inventory/${taskId}/complete`),
  getStatistics: () =>
    request.get<
      any,
      {
        assets: { total: number; in_use: number; available: number; repairing: number };
        requests: { pending: number };
        repairs: { pending: number };
        inventory: { in_progress: number };
        value: { total: number; net: number };
        categoryStats: { category: string; count: number; total_value: number }[];
      }
    >('/inventory/summary/statistics'),
};
