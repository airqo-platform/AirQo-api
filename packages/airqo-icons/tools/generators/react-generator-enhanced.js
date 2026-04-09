#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Converts a string to PascalCase.
 * @param {string} str - The string to convert
 * @returns {string} The PascalCase string
 */
function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace non-alphanumeric with spaces
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, ''); // Remove all spaces
}

/**
 * Creates unique, creative names for icons with Aq prefix
 * @param {string} baseName - Original file name
 * @param {string} group - Group name (e.g., 'Flags', 'Charts')
 * @returns {string} Enhanced component name with Aq prefix
 */
function createEnhancedIconName(baseName, group) {
  // Remove file extension and common patterns
  let cleanName = baseName
    .replace(/\.svg$/, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim();

  // Special handling for flags - make them unique and creative
  if (group === 'Flags') {
    // Country names should be clean without Flag prefix
    const countryMappings = {
      'united states of america': 'USA',
      'united kingdom': 'UK',
      'united arab emirates': 'UAE',
      'south africa': 'SouthAfrica',
      'new zealand': 'NewZealand',
      'saudi arabia': 'SaudiArabia',
      'costa rica': 'CostaRica',
      'puerto rico': 'PuertoRico',
      'south korea': 'SouthKorea',
      'north korea': 'NorthKorea',
      'el salvador': 'ElSalvador',
      'sri lanka': 'SriLanka',
      'burkina faso': 'BurkinaFaso',
      'central african republic': 'CentralAfricanRepublic',
      'dominican republic': 'DominicanRepublic',
      'equatorial guinea': 'EquatorialGuinea',
      'papua new guinea': 'PapuaNewGuinea',
      'sierra leone': 'SierraLeone',
      'solomon islands': 'SolomonIslands',
      'republic of the congo': 'Congo',
      'democratic republic of the congo': 'DRC',
    };

    const lowerName = cleanName.toLowerCase();
    const mappedName = countryMappings[lowerName] || toPascalCase(cleanName);
    return `Aq${mappedName}`;
  }

  // Convert to PascalCase and add Aq prefix
  const pascalName = toPascalCase(cleanName);

  // For Charts, clean up common patterns
  if (group === 'Charts') {
    const cleanChartName = pascalName
      .replace(/^Chart/, '')
      .replace(/Chart$/, '')
      .replace(/^Bar/, 'Bar')
      .replace(/^Line/, 'Line')
      .replace(/^Pie/, 'Pie');
    return `Aq${cleanChartName || pascalName}`;
  }

  // For General icons, remove common prefixes/suffixes
  if (group === 'General') {
    const cleanGeneralName = pascalName
      .replace(/^General/, '')
      .replace(/General$/, '')
      .replace(/^Icon/, '')
      .replace(/Icon$/, '');
    return `Aq${cleanGeneralName || pascalName}`;
  }

  // For all other groups, add Aq prefix to the clean pascal case name
  return `Aq${pascalName}`;
}

/**
 * Generate comprehensive tags for an icon based on its name and group
 * @param {string} iconName - The icon name
 * @param {string} group - The group name
 * @param {string} originalFileName - Original SVG file name
 * @returns {string[]} Array of tags
 */
function generateIconTags(iconName, group, originalFileName) {
  const tags = new Set();

  // Add group-based tags
  tags.add(group.toLowerCase());

  // Add name-based tags (remove Aq prefix for tags)
  const nameWithoutPrefix = iconName.replace(/^Aq/, '').toLowerCase();
  tags.add(nameWithoutPrefix);

  // Split camelCase and add individual words
  const words = nameWithoutPrefix.match(/[a-z]+/gi) || [];
  words.forEach((word) => {
    if (word.length > 2) {
      // Avoid very short words
      tags.add(word.toLowerCase());
    }
  });

  // Add number if present
  const numberMatch = iconName.match(/(\d+)$/);
  if (numberMatch) {
    tags.add(numberMatch[1]);
  }

  // Add context-specific tags based on group
  const groupTags = {
    General: ['ui', 'interface', 'common', 'basic'],
    Arrows: ['direction', 'navigation', 'pointer', 'chevron'],
    Charts: ['graph', 'analytics', 'data', 'visualization', 'stats'],
    Communication: ['chat', 'message', 'social', 'contact', 'network'],
    Files: ['document', 'folder', 'storage', 'data', 'export'],
    Users: ['person', 'profile', 'account', 'people', 'team'],
    Time: ['clock', 'calendar', 'schedule', 'date', 'timer'],
    Weather: ['climate', 'forecast', 'atmosphere', 'temperature'],
    Security: ['lock', 'protection', 'safety', 'shield', 'privacy'],
    Education: ['learning', 'school', 'academic', 'study', 'knowledge'],
    Finance_eCommerce: ['money', 'payment', 'bank', 'shopping', 'commerce'],
    Maps_Travel: ['location', 'travel', 'navigation', 'place', 'map'],
    Media_devices: ['media', 'device', 'player', 'audio', 'video'],
    Development: ['code', 'programming', 'developer', 'tech', 'software'],
    Editor: ['text', 'editing', 'format', 'writing', 'document'],
    Images: ['photo', 'picture', 'gallery', 'visual', 'graphics'],
    Layout: ['design', 'structure', 'grid', 'arrangement', 'template'],
    Shapes: ['geometry', 'shape', 'design', 'element', 'form'],
    Alerts_Feedback: ['alert', 'notification', 'feedback', 'warning', 'info'],
    Flags: ['country', 'nation', 'flag', 'region', 'territory'],
    AeroGlyphs: ['airqo', 'brand', 'custom', 'logo', 'identity'],
    Airqo: ['airqo', 'brand', 'logo', 'company', 'identity'],
  };

  const contextTags = groupTags[group] || [];
  contextTags.forEach((tag) => tags.add(tag));

  // Add common icon action tags based on name patterns
  if (/add|plus|create|new/i.test(iconName)) tags.add('add');
  if (/delete|remove|trash|bin/i.test(iconName)) tags.add('delete');
  if (/edit|pencil|write/i.test(iconName)) tags.add('edit');
  if (/search|find|magnify/i.test(iconName)) tags.add('search');
  if (/download|save/i.test(iconName)) tags.add('download');
  if (/upload|cloud/i.test(iconName)) tags.add('upload');
  if (/settings|config|gear/i.test(iconName)) tags.add('settings');
  if (/home|house/i.test(iconName)) tags.add('home');
  if (/user|person|profile/i.test(iconName)) tags.add('user');
  if (/heart|like|favorite/i.test(iconName)) tags.add('favorite');
  if (/star|rating/i.test(iconName)) tags.add('rating');

  return Array.from(tags);
}

/**
 * Generate icon description for accessibility and search
 * @param {string} iconName - The icon name
 * @param {string} group - The group name
 * @returns {string} Icon description
 */
function generateIconDescription(iconName, group) {
  const nameWithoutPrefix = iconName.replace(/^Aq/, '');
  const readable = nameWithoutPrefix
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();

  const groupDesc = group.replace(/_/g, ' ').toLowerCase();
  return `${readable} icon from ${groupDesc} collection`;
}

/**
 * Transforms SVG content to React component JSX with optimizations
 */
function transformSvgToJsx(svgContent) {
  let transformed = svgContent
    // Common camelCase conversions
    .replace(/stroke-width="/g, 'strokeWidth="')
    .replace(/stroke-linecap="/g, 'strokeLinecap="')
    .replace(/stroke-linejoin="/g, 'strokeLinejoin="')
    .replace(/fill-rule="/g, 'fillRule="')
    .replace(/clip-rule="/g, 'clipRule="')
    .replace(/class="/g, 'className="')
    .replace(/for="/g, 'htmlFor="')
    // SVG-specific camelCase conversions
    .replace(/clip-path="/g, 'clipPath="')
    .replace(/stop-color="/g, 'stopColor="')
    .replace(/stop-opacity="/g, 'stopOpacity="')
    .replace(/color-interpolation-filters="/g, 'colorInterpolationFilters="')
    .replace(/color-interpolation="/g, 'colorInterpolation="')
    .replace(/marker-end="/g, 'markerEnd="')
    .replace(/marker-mid="/g, 'markerMid="')
    .replace(/marker-start="/g, 'markerStart="')
    .replace(/text-anchor="/g, 'textAnchor="')
    .replace(/xlink:href=/g, 'xlinkHref=')
    .replace(/xml:space=/g, 'xmlSpace=')
    .replace(/xmlns:xlink=/g, 'xmlnsXlink=')
    .replace(/viewbox=/gi, 'viewBox=')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .trim();

  // Fix style attributes - convert from string to object format
  transformed = transformed.replace(/style="([^"]*)"/g, (match, styleValue) => {
    const styles = styleValue
      .split(';')
      .filter((s) => s.trim())
      .map((s) => {
        const [key, value] = s.split(':').map((p) => p.trim());
        const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return `${camelKey}: "${value}"`;
      })
      .join(', ');
    return `style={{${styles}}}`;
  });

  // Replace width and height ONLY on the root SVG element
  transformed = transformed.replace(
    /<svg([^>]*?)width="[^"]*"([^>]*?)height="[^"]*"([^>]*?)>/,
    '<svg$1width={size}$2height={size}$3>',
  );

  // Check if this is a monochrome icon
  const hasSpecificColors = /fill="(?!none|currentColor|black|#000000?)[#a-fA-F0-9]+"/.test(
    transformed,
  );

  if (!hasSpecificColors) {
    // Monochrome icon - replace fills and strokes with dynamic color
    transformed = transformed
      .replace(/fill="#?[0-9A-Fa-f]{3,6}"|fill="black"/g, 'fill={color}')
      .replace(/stroke="#?[0-9A-Fa-f]{3,6}"|stroke="black"/g, 'stroke={color}');
  }

  // Add ref and spread props to the root SVG element
  transformed = transformed.replace(
    /<svg([^>]*)>/,
    '<svg$1 ref={ref} className={className} {...props}>',
  );

  return transformed;
}

/**
 * Generates an optimized React component from SVG source code.
 */
async function generateReactComponent(svgContent, componentName, relativePath = '../types') {
  try {
    const jsxContent = transformSvgToJsx(svgContent);

    // Generate optimized component with better tree-shaking support
    const componentCode = `import React from 'react';
import type { IconProps } from '${relativePath}';

export interface ${componentName}Props extends IconProps {}

const ${componentName} = React.forwardRef<SVGSVGElement, ${componentName}Props>(
  ({ size = 24, color = 'currentColor', className, ...props }, ref) => (
    ${jsxContent}
  )
);

${componentName}.displayName = '${componentName}';

export default ${componentName};
`;

    return componentCode;
  } catch (error) {
    console.error(`Failed to generate component ${componentName}:`, error);
    throw error;
  }
}

/**
 * Validates that a directory exists and is readable
 */
async function validateDirectory(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Creates directory recursively if it doesn't exist
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Get all SVG files from a directory
 */
async function getSvgFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter((file) => file.toLowerCase().endsWith('.svg')).sort();
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * Get all subdirectories from a directory
 */
async function getSubdirectories(dirPath) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * Process SVG files and create flat export structure
 */
async function processSvgFiles(
  sourceDir,
  outputDir,
  groupName,
  typesPath = './types',
  globalComponentNames = new Set(),
  allDuplicates = [],
  iconGroupMap = {},
) {
  const svgFiles = await getSvgFiles(sourceDir);

  if (svgFiles.length === 0) {
    return { count: 0, exports: [] };
  }

  console.log(`📁  ${groupName}: ${svgFiles.length} svg(s)`);

  const exports = [];
  let processedCount = 0;

  // Process each SVG file
  for (const svgFile of svgFiles) {
    try {
      const svgPath = path.join(sourceDir, svgFile);
      const svgContent = await fs.readFile(svgPath, 'utf-8');

      // Generate enhanced component name
      const baseName = path.basename(svgFile, '.svg');
      let componentName = createEnhancedIconName(baseName, groupName);

      // Validate component name
      if (!componentName || !/^[A-Z][a-zA-Z0-9]*$/.test(componentName)) {
        console.warn(`⚠️  Skipping invalid component name: ${baseName} -> ${componentName}`);
        continue;
      }

      // Check for duplicate names globally
      if (globalComponentNames.has(componentName)) {
        const uniqueName = `${componentName}${groupName}`;
        allDuplicates.push({
          original: componentName,
          unique: uniqueName,
          group: groupName,
        });
        console.warn(`⚠️  Duplicate name ${componentName} found, using ${uniqueName}`);
        componentName = uniqueName;
      }

      // Add to global tracking
      globalComponentNames.add(componentName);
      // Track group for this icon
      if (iconGroupMap) {
        iconGroupMap[componentName] = groupName;
      }

      // Generate component code
      const componentCode = await generateReactComponent(svgContent, componentName, typesPath);
      const outputPath = path.join(outputDir, `${componentName}.tsx`);
      await fs.writeFile(outputPath, componentCode);

      // Add to exports
      exports.push(`export { default as ${componentName} } from './${componentName}';`);
      exports.push(`export type { ${componentName}Props } from './${componentName}';`);

      processedCount++;
    } catch (error) {
      console.error(`❌ Failed to process ${svgFile}:`, error.message);
    }
  }

  return {
    count: processedCount,
    exports,
  };
}

/**
 * Recursively process groups and create flat structure
 */
async function processGroupRecursively(
  sourceDir,
  outputDir,
  groupName,
  globalComponentNames = new Set(),
  allDuplicates = [],
  depth = 0,
  iconGroupMap = {},
) {
  let totalCount = 0;
  const allExports = [];

  // Calculate types path
  const typesPath = './types';

  // Process SVG files directly in this directory
  const directSvgResult = await processSvgFiles(
    sourceDir,
    outputDir,
    groupName,
    typesPath,
    globalComponentNames,
    allDuplicates,
    iconGroupMap,
  );

  totalCount += directSvgResult.count;
  allExports.push(...directSvgResult.exports);

  // Process subdirectories
  const subdirs = await getSubdirectories(sourceDir);

  for (const subdir of subdirs) {
    const subSourceDir = path.join(sourceDir, subdir);
    // For nested structures like Flags/A, Flags/B, keep the parent group name (Flags)
    // But for top-level groups, use the subdir name
    const subGroupName = groupName;

    const subResult = await processGroupRecursively(
      subSourceDir,
      outputDir,
      subGroupName,
      globalComponentNames,
      allDuplicates,
      depth + 1,
      iconGroupMap,
    );

    totalCount += subResult.count;
    allExports.push(...subResult.allExports);
  }

  return {
    count: totalCount,
    allExports,
  };
}

/**
 * Creates the enhanced types file with better tree-shaking
 */
async function createTypesFile(outRoot) {
  const typesContent = `// Auto-generated file. Do not edit manually.

export interface IconProps {
  /**
   * The size of the icon. Can be a number (px) or string with units.
   * @default 24
   */
  size?: number | string;
  
  /**
   * The color of the icon. Accepts any valid CSS color value.
   * @default 'currentColor'
   */
  color?: string;
  
  /**
   * Additional CSS class name(s) to apply to the icon.
   */
  className?: string;
}

export type IconComponent = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;
`;

  await fs.writeFile(path.join(outRoot, 'types.ts'), typesContent);
}

/**
 * Cleans the output directory
 */
async function cleanOutputDirectory(outRoot) {
  try {
    if (fsSync.existsSync(outRoot)) {
      await fs.rm(outRoot, { recursive: true, force: true });
    }
    await ensureDirectory(outRoot);
  } catch (error) {
    console.error('Failed to clean output directory:', error);
    throw error;
  }
}

/**
 * Main function to generate optimized React icons with flat structure
 */
async function generateReactIcons() {
  // Scan under packages/core/src/icons for icon files
  const iconRoot = path.join(__dirname, '../../packages/core/src/icons');
  const outRoot = path.join(__dirname, '../../packages/react/src/components');

  console.log('🚀 Starting Enhanced React icon generation...');
  console.log(`📂 Source: ${iconRoot}`);
  console.log(`📂 Output: ${outRoot}`);

  try {
    // Validate source directory
    if (!(await validateDirectory(iconRoot))) {
      throw new Error(`Source directory does not exist: ${iconRoot}`);
    }

    // Clean and create output directory
    console.log('🧹 Cleaning output directory...');
    await cleanOutputDirectory(outRoot);

    // Create shared types file
    console.log('📝 Creating types file...');
    await createTypesFile(outRoot);

    // Get all icon groups (folders under icons)
    const files = await fs.readdir(iconRoot, { withFileTypes: true });
    const groups = files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();

    if (groups.length === 0) {
      console.warn('⚠️  No icon groups found.');
      return;
    }

    console.log(`📦 Processing ${groups.length} icon group(s): ${groups.join(', ')}`);

    // Global component tracking for duplicates across ALL groups
    const globalComponentNames = new Set();
    let totalIcons = 0;
    const masterExports = ["export * from './types';"];
    const allDuplicates = [];
    const iconGroupMap = {};

    // Process all groups into flat structure
    for (const group of groups) {
      const groupSourceDir = path.join(iconRoot, group);

      if (!(await validateDirectory(groupSourceDir))) {
        console.warn(`⚠️  Group directory ${group} does not exist, skipping.`);
        continue;
      }

      const result = await processGroupRecursively(
        groupSourceDir,
        outRoot,
        group,
        globalComponentNames, // Pass global set instead of map
        allDuplicates,
        0,
        iconGroupMap,
      );

      totalIcons += result.count;
      masterExports.push(...result.allExports);

      console.log(`✅  Processed ${result.count} icons from ${group}`);
    }

    // Create the main index.ts file with all flat exports
    if (masterExports.length > 1) {
      const masterIndexContent = [
        '// Auto-generated file. Do not edit manually.',
        '// This file provides flat exports for all icons without group prefixes',
        '',
        ...masterExports,
        '',
      ].join('\n');
      await fs.writeFile(path.join(outRoot, 'index.ts'), masterIndexContent);
    }

    // --- Generate register-icons.ts with enhanced metadata ---
    // For each icon, generate metadata for registration
    console.log('📝 Generating icon registration with enhanced metadata...');

    const iconFiles = (await fs.readdir(outRoot)).filter(
      (f) =>
        f.endsWith('.tsx') && f !== 'types.ts' && f !== 'register-icons.ts' && f !== 'index.ts',
    );

    // Generate enhanced metadata for each icon
    const iconMetas = iconFiles.map((file) => {
      const name = file.replace(/\.tsx$/, '');
      const group = iconGroupMap[name] || 'General';
      const originalName = name.replace(/^Aq/, ''); // Remove Aq prefix for original name

      // Generate tags and keywords based on the icon name and group
      const tags = generateIconTags(name, group, file);
      const description = generateIconDescription(name, group);

      return {
        name,
        originalName,
        group,
        tags,
        description,
      };
    });

    // Generate import and registration code with enhanced metadata
    const importLines = [
      `// Auto-generated: Registers all icons with AirQOIconsUtils`,
      `import { AirQOIconsUtils } from '../utils';`,
      `import * as icons from './index';`,
      '',
    ];

    const metaLines = [
      'const iconMetadatas = [',
      ...iconMetas.map((meta) => {
        const tagsStr = JSON.stringify(meta.tags);
        return `  {
    name: '${meta.name}',
    originalName: '${meta.originalName}',
    group: '${meta.group}',
    subgroup: undefined,
    tags: ${tagsStr},
    description: '${meta.description}',
    component: icons.${meta.name},
  },`;
      }),
      '];',
      '',
      '// Register all icons with enhanced metadata',
      'iconMetadatas.forEach(meta => {',
      '  AirQOIconsUtils.registerIcon(meta);',
      '});',
      '',
      '// Export metadata for external use',
      'export { iconMetadatas };',
      '',
      '// This file should be imported in the main entry to ensure registration happens.',
    ];

    const registerContent = [...importLines, ...metaLines].join('\n');
    await fs.writeFile(path.join(outRoot, 'register-icons.ts'), registerContent);

    // Report duplicates
    if (allDuplicates.length > 0) {
      console.log('\n⚠️  Duplicate icon names handled:');
      allDuplicates.forEach((dup) => {
        console.log(`  ${dup.original} -> ${dup.unique} (from ${dup.group})`);
      });
    }

    console.log('\n✅ Enhanced React icons generated successfully!');
    console.log(`📊 Total: ${totalIcons} icons with flat export structure and Aq prefix`);
    console.log(
      `🎯 Icons can now be imported as: import { AqHome01, AqBarChart01, AqUser } from "@airqo/icons-react"`,
    );

    if (totalIcons === 0) {
      console.warn('⚠️  No icons were generated. Check your source directory and SVG files.');
    }
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Execute the generator
if (require.main === module) {
  generateReactIcons().catch((error) => {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  });
}

module.exports = {
  generateReactIcons,
  toPascalCase,
  createEnhancedIconName,
  processSvgFiles,
  processGroupRecursively,
};
