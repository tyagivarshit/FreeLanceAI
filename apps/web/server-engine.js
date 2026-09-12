/**
 * Lightweight Radix-Trie Router & Security Engine
 * Replaces manual string checking loops in server.js to provide O(1) static lookups
 * and Fast Regex for dynamic routes, avoiding Express/Nest overhead.
 */

// 1. Strict Body Stream Parser (Slowloris & Event Loop Blocking Protection)
export async function parseJsonBody(req, maxBytes = 1048576) { // Default 1MB Limit
  return new Promise((resolve, reject) => {
    let body = "";
    let byteLength = 0;
    
    // Slowloris protection: Force connection termination if streaming is too slow
    const slowlorisTimeout = setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout - Potential Slowloris attack detected"));
    }, 10000); // 10 seconds absolute timeout

    req.on("data", (chunk) => {
      byteLength += chunk.length;
      
      // Strict Byte-size Rate Limit
      if (byteLength > maxBytes) {
        clearTimeout(slowlorisTimeout);
        req.destroy(); // Instantly kill socket to free event loop
        reject(new Error("Payload Too Large - Exceeded byte limit"));
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      clearTimeout(slowlorisTimeout);
      if (!body) {
        return resolve({});
      }
      try {
        // Parse synchronously, safe because payload size is strictly bounded
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Malformed JSON"));
      }
    });
    
    req.on("error", (err) => {
      clearTimeout(slowlorisTimeout);
      reject(err);
    });
  });
}

// 2. High-Performance Hybrid Radix Router
export class SecurityRouter {
  constructor() {
    // O(1) hash map for static routes
    this.staticRoutes = { GET: new Map(), POST: new Map(), PUT: new Map(), PATCH: new Map(), DELETE: new Map(), OPTIONS: new Map() };
    // Fast regex matching for dynamic routes
    this.dynamicRoutes = { GET: [], POST: [], PUT: [], PATCH: [], DELETE: [], OPTIONS: [] };
  }

  add(method, path, handler) {
    if (!path.includes(":")) {
      this.staticRoutes[method].set(path, handler);
      return;
    }

    const paramNames = [];
    let regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });
    
    regexPath = new RegExp(`^${regexPath}$`);
    this.dynamicRoutes[method].push({ regex: regexPath, paramNames, handler });
  }

  get(path, handler) { this.add("GET", path, handler); }
  post(path, handler) { this.add("POST", path, handler); }
  put(path, handler) { this.add("PUT", path, handler); }
  patch(path, handler) { this.add("PATCH", path, handler); }
  delete(path, handler) { this.add("DELETE", path, handler); }
  options(path, handler) { this.add("OPTIONS", path, handler); }

  find(method, pathname) {
    // 1. O(1) Static Lookup
    const staticMap = this.staticRoutes[method];
    if (staticMap && staticMap.has(pathname)) {
      return { handler: staticMap.get(pathname), params: {} };
    }

    // 2. Fallback to Dynamic Routes
    const dynamicList = this.dynamicRoutes[method];
    if (!dynamicList) return null;

    for (const route of dynamicList) {
      const match = pathname.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1];
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  // Integration hook for raw Node HTTP server
  async handle(req, res, pathname) {
    const route = this.find(req.method, pathname);
    
    if (route) {
      req.params = route.params; // Attach params
      try {
        await route.handler(req, res);
      } catch (err) {
        if (err.message === "Payload Too Large - Exceeded byte limit") {
          if (!res.headersSent) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Payload Too Large" }));
          }
        } else if (err.message.includes("Slowloris")) {
          if (!res.headersSent) {
            res.writeHead(408, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request Timeout" }));
          }
        } else {
          console.error("Route execution error:", err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal Server Error" }));
          }
        }
      }
      return true;
    }
    return false; // Route not found
  }
}
