const { Client } = require('pg');
const run = async () => {
  const c = new Client({ connectionString: 'postgres://postgres:postgres_password_local@localhost:5433/freelanceos_dev' });
  await c.connect();
  await c.query("CREATE TYPE project_status AS ENUM('Draft', 'Planned', 'Active', 'Paused', 'Completed', 'Cancelled', 'Archived');").catch(e=>{});
  await c.query("CREATE TABLE IF NOT EXISTS projects ( id uuid PRIMARY KEY NOT NULL, tenant_id uuid NOT NULL, client_id uuid NOT NULL, owner_id uuid NOT NULL, project_reference varchar(255) NOT NULL, metadata jsonb NOT NULL, visibility jsonb NOT NULL, status project_status NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL );");
  console.log('Done');
  await c.end();
};
run();
