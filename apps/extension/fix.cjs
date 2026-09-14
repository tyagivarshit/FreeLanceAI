const fs = require('fs');
let s = fs.readFileSync('test/popup.test.ts', 'utf8');
s = s.replace(/import \{ test, describe, beforeEach, afterEach \} from "node:test";/, 'import { test, describe } from "node:test";');
fs.writeFileSync('test/popup.test.ts', s);
