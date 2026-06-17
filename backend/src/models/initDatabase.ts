import db from '../config/database';
import bcrypt from 'bcryptjs';

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      original_value DECIMAL(12,2) NOT NULL,
      net_value DECIMAL(12,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      location TEXT,
      description TEXT,
      current_user_id INTEGER,
      last_depreciation_month TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS borrow_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      expected_return_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approval_time DATETIME,
      approval_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (requester_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrow_request_id INTEGER NOT NULL,
      asset_id INTEGER NOT NULL,
      returner_id INTEGER NOT NULL,
      return_status TEXT NOT NULL,
      return_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (borrow_request_id) REFERENCES borrow_requests(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (returner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS repair_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      return_record_id INTEGER,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      cost DECIMAL(12,2) DEFAULT 0,
      repair_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (return_record_id) REFERENCES return_records(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      quarter TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      creator_id INTEGER,
      deadline TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      asset_id INTEGER NOT NULL,
      checker_id INTEGER,
      status TEXT DEFAULT 'pending',
      check_note TEXT,
      checked_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES inventory_tasks(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (checker_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS depreciation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      depreciation_amount DECIMAL(12,2) NOT NULL,
      net_value_before DECIMAL(12,2) NOT NULL,
      net_value_after DECIMAL(12,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminPassword = bcrypt.hashSync('admin123', salt);
    const userPassword = bcrypt.hashSync('user123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, password, name, role, department)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', adminPassword, '系统管理员', 'admin', '信息技术部');
    insertUser.run('zhangsan', userPassword, '张三', 'employee', '市场部');
    insertUser.run('lisi', userPassword, '李四', 'employee', '财务部');

    const insertAsset = db.prepare(`
      INSERT INTO assets (asset_no, name, category, purchase_date, original_value, net_value, status, location, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAsset.run('AST-2024-001', 'ThinkPad X1 Carbon', '笔记本电脑', '2024-01-15', 12000.00, 12000.00, 'available', 'A栋3楼仓库', '联想商务笔记本');
    insertAsset.run('AST-2024-002', 'MacBook Pro 14', '笔记本电脑', '2024-02-20', 16000.00, 16000.00, 'available', 'A栋3楼仓库', '苹果专业笔记本');
    insertAsset.run('AST-2024-003', 'Dell U2723QE', '显示器', '2024-03-10', 4500.00, 4500.00, 'available', 'A栋3楼仓库', '27寸4K显示器');
    insertAsset.run('AST-2024-004', 'HP LaserJet Pro', '打印机', '2023-06-01', 2800.00, 2613.33, 'available', 'B栋2楼机房', '黑白激光打印机');
    insertAsset.run('AST-2024-005', '办公桌椅套装', '办公家具', '2023-09-01', 1500.00, 1425.00, 'available', 'C栋1楼仓库', '人体工学办公桌椅');
  }

  console.log('Database initialized successfully');
}
