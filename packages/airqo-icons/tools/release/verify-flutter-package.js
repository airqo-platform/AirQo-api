#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../..');
const packageRoot = path.join(repositoryRoot, 'packages/flutter');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), 'utf8');
}

function requiredFile(relativePath) {
  const filePath = path.join(packageRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required package file: ${relativePath}`);
  }
}

function isIgnoredByGit(relativePath) {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '--quiet', relativePath], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function verifyStructure() {
  const pubspec = read('pubspec.yaml');
  const versionMatch = pubspec.match(/^version:\s*([^\s]+)$/m);
  const nameMatch = pubspec.match(/^name:\s*([^\s]+)$/m);

  if (!nameMatch || nameMatch[1] !== 'airqo_icons_flutter') {
    fail('pubspec.yaml must declare the airqo_icons_flutter package name.');
  }

  if (!versionMatch || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionMatch[1])) {
    fail('pubspec.yaml must declare a valid package version.');
  }

  requiredFile('lib/airqo_icons_flutter.dart');
  requiredFile('lib/src/airqo_icons.dart');
  requiredFile('lib/src/version.dart');
  requiredFile('README.md');
  requiredFile('CHANGELOG.md');
  requiredFile('LICENSE');

  const publicEntryPoint = read('lib/airqo_icons_flutter.dart');
  if (!publicEntryPoint.includes("export 'src/airqo_icons.dart';")) {
    fail('The public entrypoint must export src/airqo_icons.dart.');
  }

  const mainLibrary = read('lib/src/airqo_icons.dart');
  const relativeExports = [...mainLibrary.matchAll(/^export '([^']+)';$/gm)].map((match) => match[1]);
  for (const relativeExport of relativeExports) {
    requiredFile(path.join('lib/src', relativeExport));
  }

  const dartFileCount = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.name.endsWith('.dart')) dartFileCount.push(entryPath);
    }
  };
  visit(path.join(packageRoot, 'lib'));
  if (dartFileCount.length < 2) {
    fail('The package lib/ directory does not contain generated Dart libraries.');
  }

  if (isIgnoredByGit('packages/flutter/lib/airqo_icons_flutter.dart')) {
    fail('The public Flutter library is ignored by Git and may be omitted from pub.dev.');
  }

  if (process.exitCode) return false;
  console.log(`✅ Flutter package structure is valid (${dartFileCount.length} Dart files, version ${versionMatch[1]}).`);
  return true;
}

function runPubDryRun() {
  const dartExecutable =
    process.platform === 'win32'
      ? [
          path.join(
            process.env.LOCALAPPDATA || '',
            'flutter',
            'bin',
            'cache',
            'dart-sdk',
            'bin',
            'dart.exe',
          ),
          path.join(process.env.LOCALAPPDATA || '', 'flutter', 'bin', 'dart.bat'),
          'dart.exe',
        ].find((candidate) => candidate !== 'dart.exe' && fs.existsSync(candidate)) || 'dart.exe'
      : 'dart';

  if (process.platform !== 'win32') {
    try {
      execFileSync('which', ['dart'], { stdio: 'ignore' });
    } catch {
      console.warn('⚠️ Dart SDK not found; run `dart pub publish --dry-run` before publishing.');
      return;
    }
  } else if (dartExecutable === 'dart.exe') {
    try {
      execFileSync('where.exe', ['dart.exe'], { stdio: 'ignore' });
    } catch {
      console.warn('⚠️ Dart SDK not found; run `dart pub publish --dry-run` before publishing.');
      return;
    }
  }

  if (!dartExecutable) {
    console.warn('⚠️ Dart SDK not found; run `dart pub publish --dry-run` before publishing.');
    return;
  }

  try {
    execFileSync(dartExecutable, ['pub', 'publish', '--dry-run'], {
      cwd: packageRoot,
      stdio: 'inherit',
      timeout: 60_000,
    });
  } catch (error) {
    fail(
      error.signal === 'SIGTERM'
        ? 'Dart pub publish --dry-run timed out after 60 seconds.'
        : `Dart pub publish --dry-run failed: ${error.message}`,
    );
  }
}

if (verifyStructure() && !process.argv.includes('--structure-only')) {
  runPubDryRun();
}
