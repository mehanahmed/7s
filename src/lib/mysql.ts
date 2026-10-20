import * as mysql from 'mysql2/promise';
import { bustForSql } from './ttl-cache';

const globalForMysql = global as unknown as { pool: mysql.Pool };

const pool = globalForMysql.pool || mysql.createPool({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'erp_database',
    port: parseInt(process.env.DATABASE_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
});

if (process.env.NODE_ENV !== 'production') {
    globalForMysql.pool = pool;
}

export async function query<T>(sql: string, params?: any[]): Promise<T> {
    const [results] = await pool.execute(sql, params);
    bustForSql(sql);
    return results as T;
}

export default pool;
