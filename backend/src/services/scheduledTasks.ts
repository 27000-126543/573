import cron from 'node-cron';
import db from '../config/database';

const USEFUL_LIFE_YEARS = 5;
const SALVAGE_VALUE_RATE = 0.05;

export function calculateMonthlyDepreciation(originalValue: number, purchaseDate: string, currentNetValue: number): number {
  const purchase = new Date(purchaseDate);
  const now = new Date();

  const salvageValue = originalValue * SALVAGE_VALUE_RATE;
  const totalDepreciable = originalValue - salvageValue;
  const totalMonths = USEFUL_LIFE_YEARS * 12;

  const monthlyDepreciation = totalDepreciable / totalMonths;

  const newNetValue = Math.max(currentNetValue - monthlyDepreciation, salvageValue);
  const actualDepreciation = currentNetValue - newNetValue;

  return actualDepreciation;
}

export function runDepreciationCalculation(): { processed: number; totalAmount: number } {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const assets = db.prepare(`
    SELECT id, asset_no, name, original_value, purchase_date, net_value, status, last_depreciation_month
    FROM assets
    WHERE status != 'scrapped' AND status != 'lost'
  `).all() as any[];

  let processedCount = 0;
  let totalAmount = 0;

  const insertLog = db.prepare(`
    INSERT INTO depreciation_logs (asset_id, month, depreciation_amount, net_value_before, net_value_after)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateAsset = db.prepare(`
    UPDATE assets SET net_value = ?, last_depreciation_month = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const asset of assets) {
      if (asset.last_depreciation_month === currentMonth) {
        continue;
      }

      const depreciation = calculateMonthlyDepreciation(
        asset.original_value,
        asset.purchase_date,
        asset.net_value
      );

      if (depreciation > 0) {
        const netValueBefore = asset.net_value;
        const netValueAfter = Math.max(0, asset.net_value - depreciation);

        insertLog.run(asset.id, currentMonth, depreciation, netValueBefore, netValueAfter);
        updateAsset.run(netValueAfter, currentMonth, asset.id);

        processedCount++;
        totalAmount += depreciation;
      }
    }
  });

  transaction();

  console.log(`[折旧计算完成: 处理 ${processedCount} 项资产，总折旧额 ${totalAmount.toFixed(2)} 元`);
  return { processed: processedCount, totalAmount };
}

export function generateQuarterlyInventory(): { created: boolean; taskId?: number; name?: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthToQuarter: Record<number, string> = { 1: 'Q1', 4: 'Q2', 7: 'Q3', 10: 'Q4' };

  const startMonths = [1, 4, 7, 10];
  if (!startMonths.includes(month)) {
    return { created: false };
  }

  const quarter = monthToQuarter[month];
  const existing = db.prepare('SELECT id FROM inventory_tasks WHERE year = ? AND quarter = ?').get(year, quarter);

  if (existing) {
    return { created: false };
  }

  const taskName = `${year}年${quarter}资产盘点`;

  const transaction = db.transaction(() => {
    const taskInfo = db.prepare(`
      INSERT INTO inventory_tasks (task_name, quarter, year, status, creator_id)
      VALUES (?, ?, ?, 'in_progress', 1)
    `).run(taskName, quarter, year, 1);

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
  console.log(`[盘点任务生成: ${taskName}, 任务ID: ${taskId}`);

  return { created: true, taskId: Number(taskId), name: taskName };
}

export function initScheduledTasks(): void {
  console.log('定时任务已启动');

  cron.schedule('0 0 1 * * *', () => {
    console.log('[定时任务] 开始计算当月折旧...');
    try {
      const result = runDepreciationCalculation();
      console.log(`[定时任务] 折旧计算完成: ${result.processed} 项，${result.totalAmount.toFixed(2)} 元`);
    } catch (error) {
      console.error('[定时任务] 折旧计算失败:', error);
    }
  });

  cron.schedule('0 10 1 1,4,7,10 *', () => {
    console.log('[定时任务] 生成季度盘点任务...');
    try {
      const result = generateQuarterlyInventory();
      if (result.created) {
        console.log(`[定时任务] 盘点任务已生成: ${result.name}`);
      } else {
        console.log('[定时任务] 本季度盘点任务已存在，跳过');
      }
    } catch (error) {
      console.error('[定时任务] 盘点任务生成失败:', error);
    }
  });

  console.log('  - 每日凌晨 00:00 - 折旧计算');
  console.log('  - 每季度首日 01:10 - 生成盘点任务');
}
