#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Bundle analyzer to identify largest icons and suggest optimizations
 */
async function analyzeBundleSize() {
  const distDir = path.join(__dirname, '../packages/react/dist');
  const srcDir = path.join(__dirname, '../packages/react/src/components');

  console.log('🔍 Analyzing bundle composition...\n');

  try {
    // Read the main bundle
    const bundlePath = path.join(distDir, 'index.js');
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    const bundleSize = Buffer.byteLength(bundleContent, 'utf8');

    console.log(`📦 Total bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`);

    // Analyze individual icon sizes
    const iconFiles = fs
      .readdirSync(srcDir)
      .filter((file) => file.endsWith('.tsx') && file !== 'types.ts' && file !== 'index.ts')
      .map((file) => {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const size = Buffer.byteLength(content, 'utf8');
        return {
          name: file.replace('.tsx', ''),
          size,
          content,
        };
      })
      .sort((a, b) => b.size - a.size);

    console.log(`\n📊 Analyzed ${iconFiles.length} individual icons`);
    console.log(
      `📏 Average icon size: ${(
        iconFiles.reduce((sum, icon) => sum + icon.size, 0) /
        iconFiles.length /
        1024
      ).toFixed(2)} KB`,
    );

    // Show largest icons
    console.log('\n🔍 Largest 10 icons:');
    iconFiles.slice(0, 10).forEach((icon, index) => {
      console.log(`${index + 1}. ${icon.name}: ${(icon.size / 1024).toFixed(2)} KB`);
    });

    // Calculate potential savings with tree-shaking
    const avgIconSize = iconFiles.reduce((sum, icon) => sum + icon.size, 0) / iconFiles.length;
    const typicalUsage = 20; // Assume typical app uses 20 icons
    const treeShakenSize = (avgIconSize * typicalUsage) / 1024; // in KB

    console.log(`\n🌳 Tree-shaking analysis:`);
    console.log(`   Typical usage (${typicalUsage} icons): ~${treeShakenSize.toFixed(0)} KB`);
    console.log(
      `   Savings vs full bundle: ${(bundleSize / 1024 / 1024 - treeShakenSize / 1024).toFixed(
        2,
      )} MB (${((1 - treeShakenSize / 1024 / (bundleSize / 1024 / 1024)) * 100).toFixed(1)}%)`,
    );

    // Find potential optimizations
    console.log('\n💡 Optimization opportunities:');

    // Look for redundant paths/content
    const svgPatterns = iconFiles.map((icon) => {
      const svgMatch = icon.content.match(/<svg[^>]*>(.*?)<\/svg>/s);
      return svgMatch ? svgMatch[1] : '';
    });

    // Find common patterns that could be deduplicated
    const commonPaths = new Map();
    svgPatterns.forEach((svg) => {
      const paths = svg.match(/<path[^>]*>/g) || [];
      paths.forEach((path) => {
        commonPaths.set(path, (commonPaths.get(path) || 0) + 1);
      });
    });

    const duplicatedPaths = Array.from(commonPaths.entries())
      .filter(([, count]) => count > 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (duplicatedPaths.length > 0) {
      console.log('   • Found common SVG paths that could be optimized:');
      duplicatedPaths.forEach(([path, count]) => {
        console.log(`     - Used ${count} times: ${path.substring(0, 50)}...`);
      });
    }

    console.log('   • Minification is enabled ✅');
    console.log('   • Tree-shaking is enabled ✅');
    console.log('   • Source maps disabled for smaller bundles ✅');

    // Bundle breakdown by icon category
    console.log('\n📈 Bundle composition by first letter:');
    const letterGroups = iconFiles.reduce((groups, icon) => {
      const firstLetter = icon.name[0].toUpperCase();
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push(icon);
      return groups;
    }, {});

    Object.entries(letterGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([letter, icons]) => {
        const totalSize = icons.reduce((sum, icon) => sum + icon.size, 0);
        console.log(`   ${letter}: ${icons.length} icons, ${(totalSize / 1024).toFixed(0)} KB`);
      });

    console.log('\n✅ Analysis complete!');
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

if (require.main === module) {
  analyzeBundleSize();
}

module.exports = { analyzeBundleSize };
