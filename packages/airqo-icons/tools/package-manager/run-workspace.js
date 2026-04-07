#!/usr/bin/env node
const { execSync } = require('child_process');
const { detectPackageManager } = require('./detect-manager');

const manager = detectPackageManager();
const workspace = process.argv[2];
const command = process.argv[3];

if (!workspace || !command) {
  console.error('❌ Usage: run-workspace.js <workspace> <command>');
  process.exit(1);
}

// Map workspace paths to package names
const workspaceMap = {
  'packages/core': '@airqo/icons-core',
  'packages/react': '@airqo/icons-react',
  'packages/flutter': '@airqo/icons-flutter',
  'packages/vue': '@airqo/icons-vue',
  'packages/svelte': '@airqo/icons-svelte',
};

const packageName = workspaceMap[workspace] || workspace;

const commands = {
  npm: `npm run ${command} --workspace=${packageName}`,
  yarn: `yarn workspace ${packageName} ${command}`,
  pnpm: `pnpm --filter ${packageName} ${command}`,
};

const cmd = commands[manager];
console.log(`🔄 Running: ${cmd} (using ${manager})`);

try {
  execSync(cmd, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}
