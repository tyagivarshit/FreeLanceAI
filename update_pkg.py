import json
import os
import shutil

pkg_path = 'apps/extension/package.json'
with open(pkg_path, 'r', encoding='utf8') as f:
    pkg = json.load(f)

pkg['scripts'] = {
    'clean': 'node -e "const fs = require(\'fs\'); fs.rmSync(\'dist\', { recursive: true, force: true }); fs.rmSync(\'tsconfig.tsbuildinfo\', { force: true });"',
    'build': 'npm run clean && node esbuild.config.js',
    'typecheck': 'tsc --noEmit',
    'package': 'npm run build && node scripts/package-zip.js',
    'test': 'node --test'
}

if 'devDependencies' not in pkg:
    pkg['devDependencies'] = {}
pkg['devDependencies']['esbuild'] = '0.23.0'
pkg['devDependencies']['archiver'] = '7.0.1'

with open(pkg_path, 'w', encoding='utf8') as f:
    json.dump(pkg, f, indent=2)

print('package.json updated')
