#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Vue icon generation...');

const sourceDir = path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'icons');
const outputDir = path.join(__dirname, '..', '..', 'packages', 'vue', 'src', 'components');

console.log(`📂 Source: ${sourceDir}`);
console.log(`📂 Output: ${outputDir}`);

// Clean output directory
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true });
}
fs.mkdirSync(outputDir, { recursive: true });

// Utility functions
function toPascalCase(str) {
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

function generateVueComponent(svgContent, iconName, groupName) {
  // Extract SVG content and parse it properly
  const svgMatch = svgContent.match(/<svg[^>]*>(.*?)<\/svg>/s);
  if (!svgMatch) {
    throw new Error(`Invalid SVG content for ${iconName}`);
  }

  const innerSvg = svgMatch[1].trim();
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  // Monochrome icons should respond to the public color prop even when the
  // source SVG contains an explicit paint value on its paths.
  const solidPaints = [...svgContent.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)]
    .map((match) => match[1].trim().toLowerCase())
    .filter(
      (paint) =>
        !['none', 'currentcolor', 'inherit'].includes(paint) && !paint.startsWith('url('),
    );
  const isMonochrome = new Set(solidPaints).size <= 1;
  const themedInnerSvg = isMonochrome
    ? innerSvg
        .replace(
          /fill="(?:currentColor|#[0-9A-Fa-f]{3,8}|(?:black|white))"/g,
          `:fill="color || 'currentColor'"`,
        )
        .replace(
          /stroke="(?:currentColor|#[0-9A-Fa-f]{3,8}|(?:black|white))"/g,
          `:stroke="color || 'currentColor'"`,
        )
    : innerSvg;

  return `<template>
  <svg
    :width="size"
    :height="size"
    :class="className"
    viewBox="${viewBox}"
    :fill="color || 'currentColor'"
    xmlns="http://www.w3.org/2000/svg"
  >
${themedInnerSvg
  .split('\n')
  .map((line) => (line ? `    ${line}` : ''))
  .join('\n')}
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: number | string
  color?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  color: undefined,
  class: undefined
})

const className = computed(() => props.class)
</script>`;
}

// Process all icon groups
const iconGroups = fs
  .readdirSync(sourceDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

let totalIcons = 0;
const allIcons = [];

console.log(`📦 Processing ${iconGroups.length} icon group(s): ${iconGroups.join(', ')}`);

for (const group of iconGroups) {
  const groupPath = path.join(sourceDir, group);

  function processDirectory(dirPath, prefix = '') {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        processDirectory(itemPath, prefix + item.name);
      } else if (item.isFile() && item.name.endsWith('.svg')) {
        const svgContent = fs.readFileSync(itemPath, 'utf8');
        const baseName = item.name.replace('.svg', '');
        const iconName = `Aq${sanitizeName(prefix + toPascalCase(baseName))}`;

        // Handle duplicates
        let finalIconName = iconName;
        let counter = 1;
        while (allIcons.some((icon) => icon.name === finalIconName)) {
          finalIconName = `${iconName}${group}`;
          if (allIcons.some((icon) => icon.name === finalIconName)) {
            finalIconName = `${iconName}${counter}`;
            counter++;
          }
        }

        const vueComponent = generateVueComponent(svgContent, finalIconName, group);
        const componentPath = path.join(outputDir, `${finalIconName}.vue`);

        fs.writeFileSync(componentPath, vueComponent);

        allIcons.push({
          name: finalIconName,
          file: `${finalIconName}.vue`,
          group,
          originalName: baseName,
        });

        totalIcons++;
      }
    }
  }

  console.log(`📁  ${group}: processing...`);
  processDirectory(groupPath);
  console.log(`✅  Processed icons from ${group}`);
}

// Generate index file
const indexContent = `// Auto-generated Vue icon components
${allIcons.map((icon) => `export { default as ${icon.name} } from './${icon.file}'`).join('\n')}

// Icon metadata
export const iconGroups = ${JSON.stringify(iconGroups, null, 2)};
export const totalIcons = ${totalIcons};
export const allIconNames = ${JSON.stringify(
  allIcons.map((i) => i.name),
  null,
  2,
)};
`;

fs.writeFileSync(path.join(outputDir, 'index.ts'), indexContent);

console.log(`✅ Vue icons generated successfully!`);
console.log(`📊 Total: ${totalIcons} icons`);
console.log(
  `🎯 Icons can now be imported as: import { AqHome01, AqBarChart01 } from "@airqo/icons-vue"`,
);
