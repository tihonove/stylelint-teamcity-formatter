import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(testDir, 'fixtures');
const versionsDir = path.join(testDir, 'versions');
const configPath = path.join(fixturesDir, '.stylelintrc.json');
const invalidCss = path.join(fixturesDir, 'invalid.css');
const validCss = path.join(fixturesDir, 'valid.css');

// Major stylelint version extracted from the directory name `stylelint-<major>`.
function majorFromDir(name) {
    const m = /^stylelint-(\d+)$/.exec(name);
    return m ? Number(m[1]) : null;
}

// How `--custom-formatter` is documented per version in the README:
//   stylelint 16+ resolves a bare package name; <= 15 needs the node_modules path.
function formatterRef(major) {
    return major >= 16 ? 'stylelint-teamcity-formatter' : 'node_modules/stylelint-teamcity-formatter';
}

// Runs the real stylelint CLI from within the version directory and returns its
// output. stylelint exits non-zero when lint problems are found — that is expected
// here, so the exit code is ignored. Formatter output goes to stdout when there are
// no errors and to stderr when the run errors (exit code 2), so both are combined.
function runStylelint(versionDir, major, file, extraEnv = {}) {
    const bin = path.join(versionDir, 'node_modules', '.bin', 'stylelint');
    const result = spawnSync(
        bin,
        [file, '--config', configPath, '--custom-formatter', formatterRef(major)],
        { cwd: versionDir, encoding: 'utf8', env: { ...process.env, ...extraEnv } }
    );
    if (result.error) {
        throw result.error;
    }
    return (result.stdout || '') + (result.stderr || '');
}

const versionDirs = existsSync(versionsDir)
    ? readdirSync(versionsDir, { withFileTypes: true })
          .filter(d => d.isDirectory() && majorFromDir(d.name) != null)
          .map(d => d.name)
          .sort()
    : [];

for (const name of versionDirs) {
    const major = majorFromDir(name);
    const versionDir = path.join(versionsDir, name);
    const stylelintInstalled = existsSync(path.join(versionDir, 'node_modules', 'stylelint'));

    if (!stylelintInstalled) {
        test(`${name}: stylelint not installed — skipped`, { skip: `run \`npm install\` in test/versions/${name}` }, () => {});
        continue;
    }

    describe(name, () => {
        test('inspections mode (default): reports rules as inspections', () => {
            const out = runStylelint(versionDir, major, invalidCss);

            assert.match(out, /##teamcity\[inspectionType id='color-no-invalid-hex'/);
            assert.match(out, /##teamcity\[inspectionType id='block-no-empty'/);

            assert.match(out, /##teamcity\[inspection typeId='color-no-invalid-hex'[^\n]*file='[^']*invalid\.css'[^\n]*line='2'/);
            assert.match(out, /##teamcity\[inspection typeId='block-no-empty'[^\n]*file='[^']*invalid\.css'[^\n]*line='4'/);
            assert.match(out, /SEVERITY='ERROR'/);
        });

        test('errors mode (env): reports findings as TeamCity tests', () => {
            const out = runStylelint(versionDir, major, invalidCss, {
                STYLELINT_TEAMCITY_FORMATTER_OUTPUT: 'errors',
            });

            assert.match(out, /##teamcity\[testSuiteStarted name='Stylelint'\]/);
            assert.match(out, /##teamcity\[testFailed/);
        });

        test('valid css: no inspection is emitted', () => {
            const out = runStylelint(versionDir, major, validCss);

            assert.doesNotMatch(out, /##teamcity\[inspection /);
        });
    });
}

if (versionDirs.length === 0) {
    test('no version directories found under test/versions', { skip: true }, () => {});
}
