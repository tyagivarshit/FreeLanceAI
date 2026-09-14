import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';

// Load .env
try {
  const envFile = fs.readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  });
} catch (e) {
  console.log('No .env file found');
}

process.env.NODE_ENV = 'development';
process.env.API_PORT = '4005';

function request(options, postData, headers = {}) {
  headers['x-forwarded-for'] = '127.0.0.' + Math.floor(Math.random() * 255);
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    Object.entries(headers).forEach(([k, v]) => req.setHeader(k, v));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runE2E() {
  console.log('Starting E2E tests...');
  const server = spawn('node', ['apps/web/server.js'], { stdio: 'inherit', env: process.env });
  
  await new Promise(r => setTimeout(r, 10000)); // wait for server to boot

  let finalCookie = '';
  let extToken = '';
  try {
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // 1. Signup
    const signupData = JSON.stringify({ email, password, firstName: 'Test', lastName: 'User' });
    const res1 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/signup', method: 'POST' }, signupData, { 'Content-Type': 'application/json' });
    console.log('Signup:', res1.statusCode, res1.body);
    if (res1.statusCode !== 201) throw new Error('Signup failed');

    const signupBody = JSON.parse(res1.body);
    const userId = signupBody.user.id;

    // 2. Inject Verification Token via DB
    const { db, emailVerifications } = await import('@freelanceos/db');
    const testRawToken = `e2e_tok_${Date.now()}`;
    const testHash = crypto.createHash("sha256").update(testRawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 3600000);
    
    await db.insert(emailVerifications).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: testHash,
      expiresAt,
      consumedAt: null,
    });
    console.log('Injected verification token.');

    // 3. Verify Email
    const resVerify = await request({ hostname: '127.0.0.1', port: 4005, path: `/api/auth/verify-email?token=${testRawToken}`, method: 'GET' }, null, {});
    console.log('Verify Email:', resVerify.statusCode);

    // 4. Login
    const loginData = JSON.stringify({ email, password });
    const res2 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/login', method: 'POST' }, loginData, { 'Content-Type': 'application/json' });
    console.log('Login:', res2.statusCode, res2.body);
    
    const loginCookie = res2.headers['set-cookie']?.find(c => c.includes('__Host-refresh_token='));
    finalCookie = loginCookie;

    if (!finalCookie) { console.error('No cookie received!'); return; }
    console.log('Session Cookie received.');

    // 5. Get Extension Token (Authorized)
    const res3 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/extension/token', method: 'GET' }, null, { 'Cookie': finalCookie });
    console.log('Get Token:', res3.statusCode);
    const extTokenData = JSON.parse(res3.body);
    extToken = extTokenData.token;

    // 6. Get Extension Token (Unauthorized)
    const res4 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/extension/token', method: 'GET' }, null, {});
    console.log('Get Token (No Cookie):', res4.statusCode, res4.body);

    // 7. Ingest Job
    const jobData = JSON.stringify({ title: 'Test Job', description: 'Test', sourcePlatform: 'UPWORK', externalJobId: '123' });
    const res5 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/jobs/import', method: 'POST' }, jobData, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${extToken}` });
    console.log('Ingest Job:', res5.statusCode, res5.body);

    // 8. Explain Job (simulate)
    const explainData = JSON.stringify({ matchId: 'mock-id' });
    const res6 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/jobs/explain', method: 'POST' }, explainData, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${extToken}` });
    console.log('Explain Job:', res6.statusCode, res6.body);

    // 9. Logout
    const res7 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/logout', method: 'POST' }, '{}', { 'Content-Type': 'application/json', 'Cookie': finalCookie });
    console.log('Logout:', res7.statusCode, res7.body);

    // 10. Ingest Job Again (Should Fail)
    const res8 = await request({ hostname: '127.0.0.1', port: 4005, path: '/api/jobs/import', method: 'POST' }, jobData, { 'Content-Type': 'application/json', 'Authorization': `Bearer ${extToken}` });
    console.log('Ingest Job after Logout:', res8.statusCode, res8.body);

  } finally {
    server.kill();
    process.exit(0);
  }
}

runE2E().catch(console.error);
