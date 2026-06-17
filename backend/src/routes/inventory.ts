import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { status, year, quarter, page = 1, pageSize = 10 } = req.query;

  let sql = `
    SELECT it.*, u.name as creator_name,
           (SELECT COUNT(*) FROM inventory_details WHERE task_id = it.id) as total_count,
           (SELECT COUNT(*) FROM inventory_details WHERE task_id = it.id AND status != 'pending') as checked_count
    FROM inventory_tasks it
    LEFT JOIN users u ON it.creator_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND it.status = ?';
    params.push(status);
  }
  if (year) {
    sql += ' AND it.year = ?';
    params.push(Number(year));
  }
  if (quarter) {
    sql += ' AND it.quarter = ?';
    params.push(quarter);
  }

  const countSql = sql.replace(/[\s\S]*\bFROM\s/i, 'SELECT COUNT(*) as count FROM ');
  const total = (db.prepare(countSql).get(...params) as { count: number }).count;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += ' ORDER BY it.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const tasks = db.prepare(sql).all(...params);

  res.json({
    tasks,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/:taskId/details', authenticate, (req: AuthRequest, res: Response): void => {
  const { taskId } = req.params;
  const { status, page = 1, pageSize = 20 } = req.query;

  const task = db.prepare(`
    SELECT it.*, u.name as creator_name,
           (SELECT COUNT(*) FROM inventory_details WHERE task_id = it.id) as total_count,
           (SELECT COUNT(*) FROM inventory_details WHERE task_id = it.id AND status != 'pending') as checked_count
    FROM inventory_tasks it
    LEFT JOIN users u ON it.creator_id = u.id
    WHERE it.id = ?
  `).get(taskId);
  if (!task) {
    res.status(404).json({ message: '盘点任务不存在' });
    return;
  }

  let sql = `
    SELECT id.*, a.asset_no, a.name as asset_name, a.category, a.status as asset_status,
           a.location, a.net_value, u.name as checker_name
    FROM inventory_details id
    LEFT JOIN assets a ON id.asset_id = a.id
    LEFT JOIN users u ON id.checker_id = u.id
    WHERE id.task_id = ?
  `;
  const params: any[] = [taskId];

  if (status) {
    sql += ' AND id.status = ?';
    params.push(status);
  }

  const countSql = sql.replace(/[\s\S]*\bFROM\s/i, 'SELECT COUNT(*) as count FROM ');
  const total = (db.prepare(countSql).get(...params) as { count: number }).count;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += ' ORDER BY a.asset_no LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const details = db.prepare(sql).all(...params);

  res.json({
    task,
    details,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.post('/generate', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { year, quarter, deadline } = req.body;
  const creatorId = req.user?.id;

  const validQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  if (!quarter || !validQuarters.includes(quarter)) {
    res.status(400).json({ message: '请选择有效的季度（Q1-Q4）' });
    return;
  }
  if (!year) {
    res.status(400).json({ message: '请选择年份' });
    return;
  }

  const existing = db.prepare('SELECT id FROM inventory_tasks WHERE year = ? AND quarter = ?').get(year, quarter);
  if (existing) {
    res.status(400).json({ message: `${year}年${quarter}的盘点任务已存在` });
    return;
  }

  if (deadline) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(deadline)) {
      res.status(400).json({ message: '截止日期格式必须为 YYYY-MM-DD' });
      return;
    }
  }

  const taskName = `${year}年${quarter}资产盘点`;

  const transaction = db.transaction(() => {
    const taskInfo = db.prepare(`
      INSERT INTO inventory_tasks (task_name, quarter, year, status, creator_id, deadline)
      VALUES (?, ?, ?, 'in_progress', ?, ?)
    `).run(taskName, quarter, year, creatorId, deadline || null);

    const taskId = taskInfo.lastInsertRowid;

    const assets = db.prepare("SELECT id FROM assets WHERE status != 'scrapped' AND status != 'lost'").all();

    const insertDetail = db.prepare(`
      INSERT INTO inventory_details (task_id, asset_id, status)
      VALUES (?, ?, 'pending')
    `);

    for (const asset of assets as any[]) {
      insertDetail.run(taskId, asset.id);
    }

    return taskId;
  });

  const taskId = transaction();

  const task = db.prepare('SELECT * FROM inventory_tasks WHERE id = ?').get(taskId);
  const detailCount = db.prepare('SELECT COUNT(*) as count FROM inventory_details WHERE task_id = ?').get(taskId) as { count: number };

  res.status(201).json({
    message: '盘点任务已生成',
    task,
    detailCount: detailCount.count
  });
});

router.put('/:taskId/details/:detailId', authenticate, (req: AuthRequest, res: Response): void => {
  const { taskId, detailId } = req.params;
  const { status, check_note } = req.body;
  const checkerId = req.user?.id;

  const validStatuses = ['checked', 'abnormal', 'missing'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: '请选择有效的盘点状态（正常/异常/缺失）' });
    return;
  }

  const detail = db.prepare('SELECT * FROM inventory_details WHERE id = ? AND task_id = ?').get(detailId, taskId);
  if (!detail) {
    res.status(404).json({ message: '盘点明细不存在' });
    return;
  }

  db.prepare(`
    UPDATE inventory_details 
    SET status = ?, checker_id = ?, check_note = ?, checked_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, checkerId, check_note || null, detailId);

  const allDetails = db.prepare('SELECT status FROM inventory_details WHERE task_id = ?').all(taskId) as any[];
  const allChecked = allDetails.every((d: any) => d.status !== 'pending');
  if (allChecked) {
    db.prepare("UPDATE inventory_tasks SET status = 'completed' WHERE id = ?").run(taskId);
  }

  const updatedDetail = db.prepare(`
    SELECT id.*, a.asset_no, a.name as asset_name, u.name as checker_name
    FROM inventory_details id
    LEFT JOIN assets a ON id.asset_id = a.id
    LEFT JOIN users u ON id.checker_id = u.id
    WHERE id.id = ?
  `).get(detailId);

  res.json({
    message: '盘点明细已更新',
    detail: updatedDetail,
    taskCompleted: allChecked
  });
});

router.put('/:taskId/complete', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { taskId } = req.params;

  const task = db.prepare('SELECT * FROM inventory_tasks WHERE id = ?').get(taskId);
  if (!task) {
    res.status(404).json({ message: '盘点任务不存在' });
    return;
  }

  db.prepare("UPDATE inventory_tasks SET status = 'completed' WHERE id = ?").run(taskId);

  const updatedTask = db.prepare('SELECT * FROM inventory_tasks WHERE id = ?').get(taskId);

  res.json({
    message: '盘点任务已标记完成',
    task: updatedTask
  });
});

router.get('/summary/statistics', authenticate, (req: AuthRequest, res: Response): void => {
  const totalAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status != 'scrapped' AND status != 'lost'").get() as { count: number };
  const inUseAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'in_use'").get() as { count: number };
  const availableAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'available'").get() as { count: number };
  const repairingAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'repairing'").get() as { count: number };
  const pendingRequests = db.prepare("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'pending'").get() as { count: number };
  const pendingRepairs = db.prepare("SELECT COUNT(*) as count FROM repair_records WHERE status IN ('pending', 'repairing')").get() as { count: number };
  const inProgressInventory = db.prepare("SELECT COUNT(*) as count FROM inventory_tasks WHERE status = 'in_progress'").get() as { count: number };

  const totalValue = db.prepare("SELECT COALESCE(SUM(original_value), 0) as total FROM assets").get() as { total: number };
  const netValue = db.prepare("SELECT COALESCE(SUM(net_value), 0) as total FROM assets").get() as { total: number };

  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count, COALESCE(SUM(net_value), 0) as total_value
    FROM assets 
    WHERE status != 'scrapped' AND status != 'lost'
    GROUP BY category ORDER BY count DESC
  `).all();

  res.json({
    assets: {
      total: totalAssets.count,
      in_use: inUseAssets.count,
      available: availableAssets.count,
      repairing: repairingAssets.count
    },
    requests: {
      pending: pendingRequests.count
    },
    repairs: {
      pending: pendingRepairs.count
    },
    inventory: {
      in_progress: inProgressInventory.count
    },
    value: {
      total: totalValue.total,
      net: netValue.total
    },
    categoryStats
  });
});

export default router;
