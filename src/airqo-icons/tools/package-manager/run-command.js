#!/usr/bin/env node
const { execSync } = require('child_process');
const { detectPackageManager } = require('./detect-manager');

const manager = detectPackageManager();
const command = process.argv[2];

if (!command) {
  console.error('❌ No command provided');
  process.exit(1);
}

const commands = {
  npm: {
    install: 'npm install',
    build: 'npm run build --workspaces',
    test: 'npm run test --workspaces',
    lint: 'npm run lint --workspaces',
    clean: 'npm run clean --workspaces',
  },
  yarn: {
    install: 'yarn install',
    build: 'yarn workspaces foreach run build',
    test: 'yarn workspaces foreach run test',
    lint: 'yarn workspaces foreach run lint',
    clean: 'yarn workspaces foreach run clean',
  },
  pnpm: {
    install: 'pnpm install',
    build: 'pnpm -r build',
    test: 'pnpm -r test',
    lint: 'pnpm -r lint',
    clean: 'pnpm -r clean',
  },
};

const cmd = commands[manager][command];
if (!cmd) {
  console.error(`❌ Command "${command}" not found for ${manager}`);
  process.exit(1);
}

console.log(`🔄 Running: ${cmd} (using ${manager})`);
try {
  execSync(cmd, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}
