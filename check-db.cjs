const { Client } = require('./node_modules/pg');

async function checkDb(connStr, label) {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log(`\n=== ${label} ===`);
    
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    );
    console.log('TABLES:', JSON.stringify(tables.rows.map(r => r.table_name)));
    console.log('TABLE_COUNT:', tables.rows.length);
    
    // Check drizzle migrations table
    try {
      const migs = await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
      console.log('DRIZZLE_MIGRATIONS:', JSON.stringify(migs.rows));
    } catch(e) {
      console.log('DRIZZLE_MIGRATIONS_TABLE: NOT FOUND -', e.message.split('\n')[0]);
    }
    
    // Check all schemas
    const schemas = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') ORDER BY schema_name`);
    console.log('SCHEMAS:', JSON.stringify(schemas.rows.map(r => r.schema_name)));
    
    await client.end();
  } catch(e) {
    console.error(`${label} FAILED:`, e.message);
    try { await client.end(); } catch {}
  }
}

async function main() {
  await checkDb(
    'postgresql://postgres:postgres_password_local@localhost:5433/freelanceos_dev',
    'DEV DB'
  );
  await checkDb(
    'postgresql://postgres:postgres_password_local@localhost:55432/freelanceos_test',
    'TEST DB'
  );
}

main().catch(console.error);
