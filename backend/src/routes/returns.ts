import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/return', authenticate, (req: AuthRequest, res: Response): void => {
  const { borrow_request_id, return_status, return_note } = req.body;
  const returnerId = req.user?.id;

  if (!borrow_request_id) {
    res.status(400).json({ message: '请选择要归还的领用申请' });
    return;
  }

  const validStatuses = ['good', 'damaged', 'lost'];
  if (!return_status || !validStatuses.includes(return_status)) {
    res.status(400).json({ message: '请选择有效的归还状态（完好/损坏/丢失）' });
    return;
  }

  const borrowRequest = db.prepare('SELECT * FROM borrow_requests WHERE id = ?').get(borrow_request_id) as any;
  if (!borrowRequest) {
    res.status(404).json({ message: '领用申请不存在' });
    return;
  }

  if (borrowRequest.status !== 'approved') {
    res.status(400).json({ message: '该申请未被批准，无法归还' });
    return;
  }

  if (borrowRequest.requester_id !== returnerId && req.user?.role !== 'admin') {
    res.status(403).json({ message: '您不是该资产的借用人，无法执行归还操作' });
    return;
  }

  const existingReturn = db.prepare('SELECT id FROM return_records WHERE borrow_request_id = ?').get(borrow_request_id);
  if (existingReturn) {
    res.status(400).json({ message: '该申请已完成归还' });
    return;
  }

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(borrowRequest.asset_id) as any;
  if (!asset) {
    res.status(404).json({ message: '关联资产不存在' });
    return;
  }

  const transaction = db.transaction(() => {
    const returnInfo = db.prepare(`
      INSERT INTO return_records (borrow_request_id, asset_id, returner_id, return_status, return_note)
      VALUES (?, ?, ?, ?, ?)
    `).run(borrow_request_id, borrowRequest.asset_id, returnerId, return_status, return_note || null);

    let newAssetStatus = 'available';
    if (return_status === 'damaged') {
      newAssetStatus = 'repairing';
    } else if (return_status === 'lost') {
      newAssetStatus = 'lost';
    }

    db.prepare(`
      UPDATE borrow_requests 
      SET status = 'completed'
      WHERE id = ?
    `).run(borrow_request_id);

    db.prepare(`
      UPDATE assets 
      SET status = ?, current_user_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAssetStatus, borrowRequest.asset_id);

    if (return_status === 'damaged') {
      const damageDescription = `归还时发现损坏。归还备注: ${return_note || '无详细说明'}`;
      db.prepare(`
        INSERT INTO repair_records (asset_id, return_record_id, description, status)
        VALUES (?, ?, ?, 'pending')
      `).run(borrowRequest.asset_id, returnInfo.lastInsertRowid, damageDescription);
    }
  });

  transaction();

  const returnRecord = db.prepare(`
    SELECT rr.*, a.asset_no, a.name as asset_name,
           u.name as returner_name, u.department as returner_department
    FROM return_records rr
    LEFT JOIN assets a ON rr.asset_id = a.id
    LEFT JOIN users u ON rr.returner_id = u.id
    WHERE rr.borrow_request_id = ?
  `).get(borrow_request_id);

  let message = '资产归还成功';
  if (return_status === 'damaged') {
    message = '资产归还成功，已自动创建维修流程';
  } else if (return_status === 'lost') {
    message = '资产已标记为丢失';
  }

  res.json({
    message,
    returnRecord
  });
});

router.get('/my-returns', authenticate, (req: AuthRequest, res: Response): void => {
  const returnerId = req.user?.id;
  const records = db.prepare(`
    SELECT rr.*, a.asset_no, a.name as asset_name, a.category,
           br.purpose, br.expected_return_date
    FROM return_records rr
    LEFT JOIN assets a ON rr.asset_id = a.id
    LEFT JOIN borrow_requests br ON rr.borrow_request_id = br.id
    WHERE rr.returner_id = ?
    ORDER BY rr.created_at DESC
  `).all(returnerId);

  res.json({ records });
});

router.get('/repair-records', authenticate, (req: AuthRequest, res: Response): void => {
  const { status, page = 1, pageSize = 10 } = req.query;

  let sql = `
    SELECT rr.*, a.asset_no, a.name as asset_name, a.category,
           u.name as returner_name
    FROM repair_records rr
    LEFT JOIN assets a ON rr.asset_id = a.id
    LEFT JOIN return_records ret ON rr.return_record_id = ret.id
    LEFT JOIN users u ON ret.returner_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND rr.status = ?';
    params.push(status);
  }

  const countSql = sql.replace(/[\s\S]*\bFROM\s/i, 'SELECT COUNT(*) as count FROM ');
  const total = (db.prepare(countSql).get(...params) as { count: number }).count;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += ' ORDER BY rr.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const records = db.prepare(sql).all(...params);

  res.json({
    records,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.put('/repair-records/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const { status, cost, repair_note } = req.body;

  const record = db.prepare('SELECT * FROM repair_records WHERE id = ?').get(id) as any;
  if (!record) {
    res.status(404).json({ message: '维修记录不存在' });
    return;
  }

  const validStatuses = ['pending', 'repairing', 'completed', 'cannot_repair'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ message: '无效的维修状态' });
    return;
  }

  const transaction = db.transaction(() => {
    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (cost !== undefined) {
      updates.push('cost = ?');
      params.push(Number(cost));
    }
    if (repair_note !== undefined) {
      updates.push('repair_note = ?');
      params.push(repair_note);
    }

    if (status === 'completed' || status === 'cannot_repair') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    params.push(id);

    if (updates.length > 0) {
      db.prepare(`UPDATE repair_records SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      if (status === 'completed') {
        db.prepare("UPDATE assets SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(record.asset_id);
      } else if (status === 'cannot_repair') {
        db.prepare("UPDATE assets SET status = 'scrapped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(record.asset_id);
      }
    }
  });

  transaction();

  const updatedRecord = db.prepare('SELECT * FROM repair_records WHERE id = ?').get(id);

  res.json({
    message: '维修记录已更新',
    record: updatedRecord
  });
});

export default router;
