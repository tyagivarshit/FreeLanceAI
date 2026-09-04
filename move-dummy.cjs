const fs = require('fs');

let loginCode = fs.readFileSync('packages/auth/src/login.ts', 'utf8');
const runEqFunc = loginCode.match(/async function runEquivalentComputationalWork.*\n(?:.*\n){8}/);
if (runEqFunc) {
  let hashCode = fs.readFileSync('packages/auth/src/hash.ts', 'utf8');
  hashCode += '\n' + runEqFunc[0].replace('async function', 'export async function') + '\n';
  fs.writeFileSync('packages/auth/src/hash.ts', hashCode);

  loginCode = loginCode.replace(runEqFunc[0], '');
  loginCode = loginCode.replace(/import { verifyPassword } from "\.\/hash\.js";/, 'import { verifyPassword, runEquivalentComputationalWork } from "./hash.js";');
  fs.writeFileSync('packages/auth/src/login.ts', loginCode);
}
