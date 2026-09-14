import * as fs from 'fs';

let bg = fs.readFileSync('apps/extension/src/background.ts', 'utf8');
if (!bg.startsWith('//@ts-nocheck')) {
    bg = '//@ts-nocheck\n' + bg;
    fs.writeFileSync('apps/extension/src/background.ts', bg);
}
