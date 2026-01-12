const fs = require('fs');
const path = require('path');

function detectPackageManager() {
  const rootDir = process.cwd();
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) {
    return 'npm';
  }
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    if (packageJson.packageManager) {
      const manager = packageJson.packageManager.split('@')[0];
      if (['npm', 'yarn', 'pnpm'].includes(manager)) {
        return manager;
      }
    }
  } catch (error) {}
  return 'npm';
}

module.exports = { detectPackageManager };
