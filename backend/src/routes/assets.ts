import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const validateAssetData = (data: any): { valid: boolean; message?: string } => {
  if (!data.asset_no || !data.asset_no.trim()) {
    return { valid: false, message: '资产编号不能为空' };
  }
  if (!data.name || !data.name.trim()) {
    return { valid: false, message: '资产名称不能为空' };
  }
  if (!data.category || !data.category.trim()) {
    return { valid: false, message: '资产类别不能为空' };
  }
  if (!data.purchase_date) {
    return { valid: false, message: '购置日期不能为空' };
  }
  if (!data.original_value || data.original_value <= 0) {
    return { valid: false, message: '原值必须大于0' };
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.purchase_date)) {
    return { valid: false, message: '购置日期格式必须为 YYYY-MM-DD' };
  }
  const purchaseDate = new Date(data.purchase_date);
  const today = new Date();
  if (purchaseDate > today) {
    return { valid: false, message: '购置日期不能晚于今天' };
  }
  const validStatuses = ['available', 'in_use', 'repairing', 'scrapped', 'lost'];
  if (data.status && !validStatuses.includes(data.status)) {
    return { valid: false, message: '无效的资产状态' };
  }
  return { valid: true };
};

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { category, status, keyword, page = 1, pageSize = 10 } = req.query;

  let sql = 'SELECT a.*, u.name as current_user_name FROM assets a LEFT JOIN users u ON a.current_user_id = u.id WHERE 1=1';
  const params: any[] = [];

  if (category) {
    sql += ' AND a.category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (a.asset_no LIKE ? OR a.name LIKE ? OR a.description LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  const countSql = sql.replace('SELECT a.*, u.name as current_user_name', 'SELECT COUNT(*) as count');
  const total = (db.prepare(countSql).get(...params) as { count: number }).count;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const assets = db.prepare(sql).all(...params);

  res.json({
    assets,
    total,
    page: Number(page),
    pageSize: Number(pageSize)
  });
});

router.get('/categories', authenticate, (req: AuthRequest, res: Response): void => {
  const categories = db.prepare('SELECT DISTINCT category FROM assets WHERE category IS NOT NULL ORDER BY category').all();
  res.json({ categories: categories.map((c: any) => c.category) });
});

router.get('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const asset = db.prepare(`
    SELECT a.*, u.name as current_user_name 
    FROM assets a 
    LEFT JOIN users u ON a.current_user_id = u.id 
    WHERE a.id = ?
  `).get(id);

  if (!asset) {
    res.status(404).json({ message: '资产不存在' });
    return;
  }

  res.json({ asset });
});

router.post('/', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const validation = validateAssetData(req.body);
  if (!validation.valid) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const { asset_no, name, category, purchase_date, original_value, status, location, description } = req.body;

  const existing = db.prepare('SELECT id FROM assets WHERE asset_no = ?').get(asset_no);
  if (existing) {
    res.status(400).json({ message: '资产编号已存在，请使用其他编号' });
    return;
  }

  const info = db.prepare(`
    INSERT INTO assets (asset_no, name, category, purchase_date, original_value, net_value, status, location, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    asset_no.trim(),
    name.trim(),
    category.trim(),
    purchase_date,
    Number(original_value),
    Number(original_value),
    status || 'available',
    location,
    description
  );

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(info.lastInsertRowid);

  res.status(201).json({
    message: '资产创建成功',
    asset
  });
});

router.put('/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ message: '资产不存在' });
    return;
  }

  const validation = validateAssetData(req.body);
  if (!validation.valid) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const { asset_no, name, category, purchase_date, original_value, status, location, description } = req.body;

  if (asset_no && asset_no !== existing.asset_no) {
    const duplicate = db.prepare('SELECT id FROM assets WHERE asset_no = ? AND id != ?').get(asset_no, id);
    if (duplicate) {
      res.status(400).json({ message: '资产编号已存在，请使用其他编号' });
      return;
    }
  }

  if (existing.status === 'in_use' && status && status !== 'in_use') {
    const activeBorrow = db.prepare(`
      SELECT id FROM borrow_requests 
      WHERE asset_id = ? AND status = 'approved' AND id NOT IN (
        SELECT borrow_request_id FROM return_records
      )
    `).get(id);
    if (activeBorrow) {
      res.status(400).json({ message: '该资产正在使用中，不能变更为其他状态' });
      return;
    }
  }

  db.prepare(`
    UPDATE assets 
    SET asset_no = ?, name = ?, category = ?, purchase_date = ?, original_value = ?, 
        status = ?, location = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    asset_no.trim(),
    name.trim(),
    category.trim(),
    purchase_date,
    Number(original_value),
    status || existing.status,
    location,
    description,
    id
  );

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);

  res.json({
    message: '资产更新成功',
    asset
  });
});

router.delete('/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ message: '资产不存在' });
    return;
  }

  if (existing.status === 'in_use') {
    res.status(400).json({ message: '该资产正在使用中，无法删除' });
    return;
  }

  const borrowCount = db.prepare('SELECT COUNT(*) as count FROM borrow_requests WHERE asset_id = ?').get(id) as { count: number };
  if (borrowCount.count > 0) {
    res.status(400).json({ message: '该资产存在领用记录，无法删除，建议标记为已报废' });
    return;
  }

  db.prepare('DELETE FROM assets WHERE id = ?').run(id);

  res.json({ message: '资产删除成功' });
});

export default router;
