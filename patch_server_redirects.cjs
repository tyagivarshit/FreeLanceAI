const fs = require('fs');
const path = require('path');
const serverFile = path.join(process.cwd(), 'apps', 'web', 'server.js');
let serverCode = fs.readFileSync(serverFile, 'utf8');

// Replace redirects to .html with clean routes
serverCode = serverCode.replace(/\/dashboard\.html/g, '/dashboard');
serverCode = serverCode.replace(/\/login\.html/g, '/login');
serverCode = serverCode.replace(/\/billing\.html/g, '/billing');

// Remove static path rewriting that appends .html
serverCode = serverCode.replace(/staticPathname = "\/[a-z-]+\.html";/g, '');

// If user tries to load any route that is NOT an API route, let's redirect them to port 5173 in dev
const devProxyInjection = `
  if (!pathname.startsWith('/api') && !pathname.includes('.')) {
    // In dev mode, we redirect to Vite server
    res.writeHead(302, { Location: "http://localhost:5173" + req.url });
    res.end();
    return;
  }
`;

// Insert devProxyInjection right after parsing url
serverCode = serverCode.replace(
  'const pathname = parsedUrl.pathname;',
  'const pathname = parsedUrl.pathname;\n' + devProxyInjection
);

fs.writeFileSync(serverFile, serverCode);
console.log("Patched server.js to remove .html redirects and forward frontend requests to Vite (5173)");
