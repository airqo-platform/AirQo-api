const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('❌ No version provided');
  process.exit(1);
}

console.log(`🔄 Updating all packages to version: ${newVersion}`);

// Recursive function to find package.json files
function findPackageFiles(dir, files = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory() && item.name !== 'node_modules') {
      findPackageFiles(fullPath, files);
    } else if (item.isFile() && item.name === 'package.json') {
      files.push(fullPath);
    }
  }

  return files;
}

const packageFiles = findPackageFiles('.');
let hasChanges = false;

packageFiles.forEach((file) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const oldVersion = pkg.version || 'undefined';

    if (pkg.version !== newVersion) {
      pkg.version = newVersion;
      hasChanges = true;
      console.log(`✅ Updated ${pkg.name || 'unnamed'} from ${oldVersion} to ${newVersion}`);
    }

    // Update internal @airqo dependencies
    let updatedDeps = 0;
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach((depType) => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach((dep) => {
          if (dep.startsWith('@airqo/') && pkg[depType][dep] !== `^${newVersion}`) {
            console.log(`  🔗 Updating internal dependency: ${dep} to ^${newVersion}`);
            pkg[depType][dep] = `^${newVersion}`;
            updatedDeps++;
            hasChanges = true;
          }
        });
      }
    });

    if (updatedDeps > 0) {
      console.log(`  📦 Updated ${updatedDeps} internal dependencies`);
    }

    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
    process.exit(1);
  }
});

console.log(hasChanges ? 'HAS_CHANGES=true' : 'HAS_CHANGES=false');
