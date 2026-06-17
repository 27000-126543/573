import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../asset_management.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
