import { pool } from "./packages/db/src/client.js";
async function run() { const start = performance.now(); for (let i = 0; i < 1000; i++) {
    await pool.query("SELECT 1;");
} const end = performance.now(); console.log(`Average: ${(end - start) / 1000}ms per query.`); process.exit(0); }
run();
