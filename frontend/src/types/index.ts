export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'employee';
  department: string;
}

export interface Asset {
  id: number;
  asset_no: string;
  name: string;
  category: string;
  purchase_date: string;
  original_value: number;
  net_value: number;
  status: 'available' | 'in_use' | 'repairing' | 'scrapped' | 'lost';
  location: string;
  description: string;
  current_user_id: number | null;
  current_user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface BorrowRequest {
  id: number;
  asset_id: number;
  requester_id: number;
  purpose: string;
  expected_return_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approver_id: number | null;
  approval_time: string | null;
  approval_comment: string | null;
  created_at: string;
  asset_no?: string;
  asset_name?: string;
  requester_name?: string;
  requester_department?: string;
  approver_name?: string;
}

export interface ReturnRecord {
  id: number;
  borrow_request_id: number;
  asset_id: number;
  returner_id: number;
  return_status: 'good' | 'damaged' | 'lost';
  return_note: string;
  created_at: string;
}

export interface RepairRecord {
  id: number;
  asset_id: number;
  return_record_id: number | null;
  description: string;
  status: 'pending' | 'repairing' | 'completed' | 'cannot_repair';
  cost: number | null;
  repair_note: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface InventoryTask {
  id: number;
  task_name: string;
  quarter: number;
  year: number;
  status: 'in_progress' | 'completed';
  creator_id: number;
  deadline: string;
  created_at: string;
  total_count?: number;
  checked_count?: number;
}

export interface InventoryDetail {
  id: number;
  task_id: number;
  asset_id: number;
  checker_id: number | null;
  status: 'pending' | 'checked' | 'abnormal' | 'missing';
  check_note: string | null;
  checked_at: string | null;
}
