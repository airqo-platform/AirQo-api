#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function prepareFlutterRelease() {
  console.log('🚀 Preparing Flutter package release...');
  execSync('node tools/generators/flutter-generator.js', { stdio: 'inherit' });
  const pubspecPath = path.join(__dirname, '../../packages/flutter/pubspec.yaml');
  const pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
  const versionMatch = pubspecContent.match(/version: (\d+\.\d+\.\d+)/);
  if (!versionMatch) {
    console.error('❌ Could not find version in pubspec.yaml');
    process.exit(1);
  }
  const currentVersion = versionMatch[1];
  console.log(`📦 Current Flutter package version: ${currentVersion}`);
  const tagName = `flutter-v${currentVersion}`;
  try {
    execSync(`git tag ${tagName}`, { stdio: 'inherit' });
    execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
    console.log(`✅ Created and pushed tag: ${tagName}`);
  } catch (error) {
    console.error('❌ Failed to create/push tag:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  prepareFlutterRelease().catch(console.error);
}

module.exports = { prepareFlutterRelease };
