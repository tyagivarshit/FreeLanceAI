import re

with open('apps/extension/src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import config
if 'import { config } from "./config.js";' not in content:
    content = 'import { config } from "./config.js";\n' + content

# Update fetch to use config.apiUrl
content = content.replace('"http://localhost:3000/api/jobs/import"', '${config.apiUrl}/api/jobs/import')

# Add AUTHORIZE_EXTENSION listener
authorize_listener = r'''  if (message.type === "AUTHORIZE_EXTENSION") {
    (async () => {
      try {
        const response = await fetch(${config.apiUrl}/api/extension/token, {
          method: 'GET',
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.token && data.tenantId) {
          await SessionStorageManager.setAuthToken(data.token, data.tenantId);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: data.error || 'Authorization failed' });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === "INGEST_JOB") {'''

content = content.replace('  if (message.type === "INGEST_JOB") {', authorize_listener)

with open('apps/extension/src/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('apps/extension/src/messaging/bus.ts', 'r', encoding='utf-8') as f:
    bus_content = f.read()

if 'import { config } from "../config.js";' not in bus_content:
    bus_content = 'import { config } from "../config.js";\n' + bus_content

bus_content = bus_content.replace('"http://localhost:3000/api/jobs/explain"', '${config.apiUrl}/api/jobs/explain')

with open('apps/extension/src/messaging/bus.ts', 'w', encoding='utf-8') as f:
    f.write(bus_content)
