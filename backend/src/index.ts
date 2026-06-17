import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './models/initDatabase';
import { initScheduledTasks, runDepreciationCalculation } from './services/scheduledTasks';

import authRoutes from './routes/auth';
import assetRoutes from './routes/assets';
import borrowRequestRoutes from './routes/borrowRequests';
import returnRoutes from './routes/returns';
import inventoryRoutes from './routes/inventory';
import { Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/borrow-requests', borrowRequestRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (_req, res: Response) => {
  res.json({ status: 'ok', message: '资产管理系统服务正常' });
});

app.post('/api/admin/run-depreciation', (_req, res: Response) => {
  const result = runDepreciationCalculation();
  res.json({ message: '折旧计算完成', ...result });
});

app.use((err: any, _req: any, res: Response, _next: any) => {
  console.error('错误:', err);
  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  企业资产管理系统 - 后端服务已启动`);
  console.log(`  服务器地址: http://localhost:${PORT}`);
  console.log(`  API 前缀: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
  console.log('默认账号:');
  console.log('  管理员: admin / admin123');
  console.log('  员工:   zhangsan / user123');
  console.log('  员工:   lisi / user123\n');

  initScheduledTasks();
});
