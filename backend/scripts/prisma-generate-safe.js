const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const clientDtsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '.prisma',
  'client',
  'index.d.ts',
);

const backendRoot = path.join(__dirname, '..');
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, 'generate'], {
  encoding: 'utf8',
  shell: false,
  cwd: backendRoot,
  stdio: 'pipe',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const eperm =
  (result.error && result.error.code === 'EPERM') ||
  /EPERM/.test(`${result.stdout || ''}${result.stderr || ''}`);

const failed = result.status !== 0 || result.error;

if (failed) {
  if (eperm) {
    if (fs.existsSync(clientDtsPath)) {
      console.warn(
        'Prisma generate was blocked by the OS (EPERM); using existing generated client.',
      );
      process.exit(0);
    }

    console.error(
      'Prisma generate was blocked (EPERM) and no generated client was found. ' +
        'Unblock executables in node_modules/@prisma/engines or re-run in an environment that allows them.',
    );
    process.exit(1);
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  process.exit(exitCode);
}
