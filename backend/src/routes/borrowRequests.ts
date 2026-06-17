import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { status, myRequests, page = 1, pageSize = 10 } = req.query;
  const userId = req.user?.id;

  let sql = `
    SELECT br.*, a.asset_no, a.name as asset_name, a.category,
           r.name as requester_name, r.department as requester_department,
           ap.name as approver_name,
           rr.return_status, rr.return_note, rr.created_at as returned_at
    FROM borrow_requests br
    LEFT JOIN assets a ON br.asset_id = a.id
    LEFT JOIN users r ON br.requester_id = r.id
    LEFT JOIN users ap ON br.approver_id = ap.id
    LEFT JOIN return_records rr ON br.id = rr.borrow_request_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (myRequests === 'true' && userId) {
    sql += ' AND br.requester_id = ?';
    params.push(userId);
  }
  if (status) {
    sql += ' AND br.status = ?';
    params.push(status);
  }

  const countSql = sql.replace(/[\s\S]*\bFROM\s/i, 'SELECT COUNT(*) as count FROM ');
  const total = (db.prepare(countSql).get(...params) as { count: number }).count;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += ' ORDER BY br.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const requests = db.prepare(sql).all(...params);

  res.json({
    requests,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/pending-count', authenticate, (req: AuthRequest, res: Response): void => {
  const count = db.prepare("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'pending'").get() as { count: number };
  res.json({ count: count.count });
});

router.post('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { asset_id, purpose, expected_return_date } = req.body;
  const requesterId = req.user?.id;

  if (!asset_id) {
    res.status(400).json({ message: '请选择要领用的资产' });
    return;
  }
  if (!purpose || !purpose.trim()) {
    res.status(400).json({ message: '请填写使用说明' });
    return;
  }

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id) as any;
  if (!asset) {
    res.status(404).json({ message: '资产不存在' });
    return;
  }

  if (asset.status !== 'available') {
    const statusText: Record<string, string> = {
      in_use: '该资产正在使用中',
      repairing: '该资产正在维修中',
      scrapped: '该资产已报废',
      lost: '该资产已丢失'
    };
    res.status(400).json({ message: statusText[asset.status] || '该资产当前不可用' });
    return;
  }

  if (expected_return_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expected_return_date)) {
      res.status(400).json({ message: '预计归还日期格式必须为 YYYY-MM-DD' });
      return;
    }
    const returnDate = new Date(expected_return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (returnDate < today) {
      res.status(400).json({ message: '预计归还日期不能早于今天' });
      return;
    }
  }

  const existingPending = db.prepare(`
    SELECT id FROM borrow_requests 
    WHERE asset_id = ? AND status IN ('pending', 'approved') AND requester_id = ?
    AND id NOT IN (SELECT borrow_request_id FROM return_records)
  `).get(asset_id, requesterId);
  if (existingPending) {
    res.status(400).json({ message: '您对该资产已有未完成的申请' });
    return;
  }

  const info = db.prepare(`
    INSERT INTO borrow_requests (asset_id, requester_id, purpose, expected_return_date, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(asset_id, requesterId, purpose.trim(), expected_return_date || null);

  const request = db.prepare(`
    SELECT br.*, a.asset_no, a.name as asset_name,
           r.name as requester_name, r.department as requester_department
    FROM borrow_requests br
    LEFT JOIN assets a ON br.asset_id = a.id
    LEFT JOIN users r ON br.requester_id = r.id
    WHERE br.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({
    message: '领用申请已提交，请等待审批',
    request
  });
});

router.put('/:id/approve', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const { approval_comment } = req.body;
  const approverId = req.user?.id;

  const request = db.prepare('SELECT * FROM borrow_requests WHERE id = ?').get(id) as any;
  if (!request) {
    res.status(404).json({ message: '申请不存在' });
    return;
  }
  if (request.status !== 'pending') {
    res.status(400).json({ message: '该申请已被处理' });
    return;
  }

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.asset_id) as any;
  if (!asset) {
    res.status(404).json({ message: '关联资产不存在' });
    return;
  }
  if (asset.status !== 'available') {
    res.status(400).json({ message: '资产当前不可用，无法批准申请' });
    return;
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE borrow_requests 
      SET status = 'approved', approver_id = ?, approval_time = CURRENT_TIMESTAMP, approval_comment = ?
      WHERE id = ?
    `).run(approverId, approval_comment || null, id);

    db.prepare(`
      UPDATE assets 
      SET status = 'in_use', current_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(request.requester_id, request.asset_id);
  });

  transaction();

  const updatedRequest = db.prepare(`
    SELECT br.*, a.asset_no, a.name as asset_name,
           r.name as requester_name, ap.name as approver_name
    FROM borrow_requests br
    LEFT JOIN assets a ON br.asset_id = a.id
    LEFT JOIN users r ON br.requester_id = r.id
    LEFT JOIN users ap ON br.approver_id = ap.id
    WHERE br.id = ?
  `).get(id);

  res.json({
    message: '申请已批准',
    request: updatedRequest
  });
});

router.put('/:id/reject', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const { approval_comment } = req.body;
  const approverId = req.user?.id;

  const request = db.prepare('SELECT * FROM borrow_requests WHERE id = ?').get(id) as any;
  if (!request) {
    res.status(404).json({ message: '申请不存在' });
    return;
  }
  if (request.status !== 'pending') {
    res.status(400).json({ message: '该申请已被处理' });
    return;
  }

  if (!approval_comment || !approval_comment.trim()) {
    res.status(400).json({ message: '请填写拒绝理由' });
    return;
  }

  db.prepare(`
    UPDATE borrow_requests 
    SET status = 'rejected', approver_id = ?, approval_time = CURRENT_TIMESTAMP, approval_comment = ?
    WHERE id = ?
  `).run(approverId, approval_comment.trim(), id);

  const updatedRequest = db.prepare(`
    SELECT br.*, a.asset_no, a.name as asset_name,
           r.name as requester_name, ap.name as approver_name
    FROM borrow_requests br
    LEFT JOIN assets a ON br.asset_id = a.id
    LEFT JOIN users r ON br.requester_id = r.id
    LEFT JOIN users ap ON br.approver_id = ap.id
    WHERE br.id = ?
  `).get(id);

  res.json({
    message: '申请已拒绝',
    request: updatedRequest
  });
});

export default router;
