import { Pool } from 'pg';

export const pgPool = new Pool({
  host: 'db.byjhclavuwlomujwuoku.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '?Mxtx_3?p?/C/vK',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
