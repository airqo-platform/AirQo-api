#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '../packages/core/src/icons');

(async () => {
  let renamed = 0;

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.svg')) {
        const safeName = entry.name.replace(/[^a-zA-Z0-9_.-]/g, '-');
        if (safeName !== entry.name) {
          const target = path.join(dir, safeName);
          try {
            await fs.rename(fullPath, target);
            renamed++;
            console.log(`✅ ${entry.name} → ${safeName}`);
          } catch (err) {
            console.error(`❌  Could not rename ${fullPath}: ${err.message}`);
          }
        }
      }
    }
  }

  await walk(ICONS_DIR);
  console.log(`🎉  ${renamed} file(s) renamed.`);
})();
