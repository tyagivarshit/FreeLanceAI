const fs = require('fs');
const path = require('path');

const webDir = path.join(process.cwd(), 'apps', 'web');
const serverFile = path.join(webDir, 'server.js');

let serverCode = fs.readFileSync(serverFile, 'utf8');

serverCode = serverCode.replace(
  'pathname === "/clients" ||',
  'pathname === "/clients" ||\n    pathname === "/projects.html" || pathname === "/projects" ||\n    pathname === "/payments.html" || pathname === "/payments" ||\n    pathname === "/attachments.html" || pathname === "/attachments" ||'
);

serverCode = serverCode.replace(
  'if (pathname === "/clients") {\n      staticPathname = "/clients.html";\n    }',
  'if (pathname === "/clients") {\n      staticPathname = "/clients.html";\n    }\n    if (pathname === "/projects") staticPathname = "/projects.html";\n    if (pathname === "/payments") staticPathname = "/payments.html";\n    if (pathname === "/attachments") staticPathname = "/attachments.html";'
);

fs.writeFileSync(serverFile, serverCode);
console.log("Updated protected routes");
