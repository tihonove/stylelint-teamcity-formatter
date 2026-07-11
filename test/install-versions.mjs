// Local convenience: build the formatter, then `npm install` in every
// test/versions/* directory so all stylelint versions can be tested at once.
//
// The build MUST run before the installs: each version depends on the formatter
// via `file:../../..`, which npm links as a symlink — the built index.js/index.cjs
// must already exist in the repo root for the package `exports` map to resolve.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(testDir);
const versionsDir = path.join(testDir, 'versions');

function run(cmd, args, cwd) {
    console.log(`\n> ${cmd} ${args.join(' ')}  (in ${cwd})`);
    const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run('npm', ['run', 'build'], rootDir);

const dirs = readdirSync(versionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(path.join(versionsDir, d.name, 'package.json')))
    .map(d => d.name)
    .sort();

for (const name of dirs) {
    run('npm', ['install'], path.join(versionsDir, name));
}

console.log('\nAll version directories installed.');
