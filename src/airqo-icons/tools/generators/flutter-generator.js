#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

/**
 * Convert kebab-case or snake_case to PascalCase
 * @param {string} str - The string to convert
 * @returns {string} PascalCase string
 */
function toPascalCase(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/[\s_-]+/g, '');
}

/**
 * Convert string to snake_case
 * @param {string} str - The string to convert
 * @returns {string} snake_case string
 */
function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Extract and clean SVG content from file
 * @param {string} svgContent - Raw SVG file content
 * @returns {string|null} Cleaned SVG content or null if invalid
 */
function extractSvgContent(svgContent) {
  const trimmed = svgContent.trim();
  if (!trimmed) return null;

  const svgMatch = trimmed.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
}

/**
 * Clean SVG content for Dart string interpolation
 * @param {string} svg - SVG content
 * @returns {string} Cleaned SVG content
 */
function cleanSvgForDart(svg) {
  return svg
    .replace(/`/g, '\\`') // Escape backticks
    .replace(/\$/g, '\\$') // Escape dollar signs
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n\s+/g, ' ') // Compact whitespace
    .trim();
}

/**
 * Generate unique class name with Aq prefix
 * @param {string} baseName - Base file name without extension
 * @param {string} groupPath - Full group path (e.g., "Alerts_Feedback")
 * @returns {string} Unique class name with Aq prefix
 */
function generateUniqueClassName(baseName, groupPath) {
  // Clean and convert base name to PascalCase
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, ' ').trim();

  const pascalBaseName = toPascalCase(cleanBaseName);

  // Add Aq prefix for consistency with React components
  return `Aq${pascalBaseName}`;
}

/**
 * Generate Flutter widget from SVG content
 * @param {string} svgContent - SVG content
 * @param {string} className - Name for the Flutter widget class
 * @param {string} fileName - Original file name for documentation
 * @returns {string} Generated Flutter widget code
 */
function generateFlutterWidget(svgContent, className, fileName) {
  const cleanedSvg = cleanSvgForDart(svgContent);

  return `import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// ${className} icon widget (${fileName})
/// 
/// A customizable SVG icon widget with configurable size and color.
class ${className} extends StatelessWidget {
  /// Creates a ${className} icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const ${className}({
    super.key,
    this.size = 24.0,
    this.color,
    this.semanticsLabel,
  });

  /// The size of the icon (width and height).
  final double size;

  /// The color to apply to the icon. If null, uses the default SVG colors.
  final Color? color;

  /// The semantic label for accessibility.
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: SvgPicture.string(
        '''${cleanedSvg}''',
        colorFilter: color != null 
            ? ColorFilter.mode(color!, BlendMode.srcIn)
            : null,
        semanticsLabel: semanticsLabel,
        fit: BoxFit.contain,
      ),
    );
  }
}`;
}

/**
 * Get all SVG files from a directory
 * @param {string} dirPath - Directory path
 * @returns {string[]} Array of SVG file names
 */
function getSvgFiles(dirPath) {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((file) => file.toLowerCase().endsWith('.svg'))
      .sort();
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * Get all subdirectories from a directory
 * @param {string} dirPath - Directory path
 * @returns {string[]} Array of subdirectory names
 */
function getSubdirectories(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error.message);
    return [];
  }
}

// Global set to track all generated class names and their source group
const generatedClassNames = new Map(); // className -> { group, iconFile }

/**
 * Process SVG files in a directory and generate Flutter widgets
 * @param {string} sourceDir - Source directory containing SVG files
 * @param {string} outputDir - Output directory for widgets
 * @param {string} displayPath - Path for logging (e.g., "Flags/A")
 * @param {string} groupName - Main group name for metadata (e.g., "Flags")
 * @returns {{count: number, exports: string[], mapping: Object}} Processing result
 */
function processSvgFiles(sourceDir, outputDir, displayPath, groupName = null) {
  const svgFiles = getSvgFiles(sourceDir);

  if (svgFiles.length === 0) {
    return { count: 0, exports: [], mapping: {} };
  }

  // Use groupName for metadata, or fall back to displayPath
  const metadataGroup = groupName || displayPath;
  console.log(`📁  ${displayPath}: ${svgFiles.length} svg(s)`);

  const exports = [];
  const mapping = {};
  let processedCount = 0;

  for (const iconFile of svgFiles) {
    try {
      const svgPath = path.join(sourceDir, iconFile);
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const cleanedSvg = extractSvgContent(svgContent);
      if (!cleanedSvg) {
        console.warn(`⚠️  Skipping ${iconFile}: Invalid SVG content`);
        continue;
      }

      const baseName = path.basename(iconFile, '.svg');
      const className = generateUniqueClassName(baseName, metadataGroup);

      // Duplicate detection logic
      if (generatedClassNames.has(className)) {
        const prev = generatedClassNames.get(className);
        console.warn(
          `⚠️  Duplicate icon class detected: ${className} (from ${iconFile} in ${metadataGroup}) already generated from ${prev.iconFile} in ${prev.group}. Skipping this occurrence.`,
        );
        continue;
      }
      generatedClassNames.set(className, { group: metadataGroup, iconFile });

      const widgetCode = generateFlutterWidget(cleanedSvg, className, iconFile);
      const outputPath = path.join(outputDir, `${className}.dart`);
      fs.writeFileSync(outputPath, widgetCode);

      exports.push(`export '${className}.dart';`);
      mapping[baseName] = className;
      processedCount++;
    } catch (error) {
      console.error(`❌ Failed to process ${iconFile}:`, error.message);
      continue;
    }
  }

  return { count: processedCount, exports, mapping };
}

/**
 * Recursively process a group directory that may contain subgroups
 * @param {string} sourceDir - Source directory path
 * @param {string} outputDir - Output directory path
 * @param {string} groupName - Main group name (e.g., "Flags" not "Flags/A")
 * @param {string} displayPath - Display path for logging (e.g., "Flags/A")
 * @param {string} libraryPrefix - Prefix for library names
 * @returns {{count: number, allExports: string[], subgroupExports: string[], mapping: Object}}
 */
function processGroupRecursively(sourceDir, outputDir, groupName, displayPath, libraryPrefix = '') {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  let totalCount = 0;
  const allExports = [];
  const subgroupExports = [];
  const allMapping = {};

  // First, process any SVG files directly in this directory
  // Use groupName for metadata, displayPath for logging
  const directSvgResult = processSvgFiles(sourceDir, outputDir, displayPath, groupName);
  totalCount += directSvgResult.count;
  allExports.push(...directSvgResult.exports);
  Object.assign(allMapping, directSvgResult.mapping);

  // Then, process any subdirectories (subgroups)
  const subdirs = getSubdirectories(sourceDir);

  for (const subdir of subdirs) {
    const subSourceDir = path.join(sourceDir, subdir);
    const subOutputDir = path.join(outputDir, subdir);
    const subDisplayPath = `${displayPath}/${subdir}`;
    const subLibraryPrefix = libraryPrefix
      ? `${libraryPrefix}_${toSnakeCase(subdir)}`
      : toSnakeCase(subdir);

    // Keep the same groupName for subdirectories to preserve metadata
    const subResult = processGroupRecursively(
      subSourceDir,
      subOutputDir,
      groupName, // Keep parent group name
      subDisplayPath, // Update display path
      subLibraryPrefix,
    );

    if (subResult.count > 0) {
      totalCount += subResult.count;

      // Create subgroup barrel file with proper snake_case library name
      const subLibraryName = `${subLibraryPrefix}_icons`;
      const subGroupBarrelContent = `/// ${subdir.charAt(0).toUpperCase() + subdir.slice(1)} Icons
/// 
/// This library contains ${subResult.count} icon widgets for ${subDisplayPath}.

library ${subLibraryName};

${subResult.allExports.length ? subResult.allExports.join('\n') : '// No icons available'}

// Subgroups
${subResult.subgroupExports.join('\n')}
`;

      fs.writeFileSync(path.join(subOutputDir, `${subdir}.dart`), subGroupBarrelContent);

      // Add subgroup export to parent
      subgroupExports.push(`export '${subdir}/${subdir}.dart';`);

      console.log(`✅  Generated ${subResult.count} components for ${subDisplayPath}`);
    }
  }

  return {
    count: totalCount,
    allExports,
    subgroupExports,
    mapping: allMapping,
  };
}

/**
 * Process icons in a specific group directory
 * @param {string} iconRoot - Root directory for icons
 * @param {string} outRoot - Output directory for widgets
 * @param {string} group - Group name
 * @returns {{exports: string[], count: number, mapping: Object}}
 */
function processIconGroup(iconRoot, outRoot, group) {
  const groupDir = path.join(outRoot, group);
  const groupPath = path.join(iconRoot, group);

  // Validate group directory exists
  if (!fs.existsSync(groupPath)) {
    console.warn(`⚠️  Group directory ${group} does not exist, skipping...`);
    return { exports: [], count: 0, mapping: {} };
  }

  const result = processGroupRecursively(groupPath, groupDir, group, group, toSnakeCase(group));

  // Create group barrel file with proper snake_case library name
  if (result.count > 0) {
    const libraryName = `${toSnakeCase(group)}_icons`;
    const groupBarrelContent = `/// ${group.charAt(0).toUpperCase() + group.slice(1)} Icons
/// 
/// This library contains ${result.count} icon widgets for ${group}.

library ${libraryName};

${result.allExports.length ? result.allExports.join('\n') : '// No icons available'}

// Subgroups
${result.subgroupExports.join('\n')}
`;

    fs.writeFileSync(path.join(groupDir, `${group}.dart`), groupBarrelContent);
    console.log(`✅  Generated ${result.count} components for ${group}`);
  }

  return {
    exports: result.count > 0 ? [`export '${group}/${group}.dart';`] : [],
    count: result.count,
    mapping: result.mapping,
  };
}

/**
 * Generate version file with build information
 * @param {string} outRoot - Output directory
 * @param {number} totalIcons - Total number of icons generated
 * @param {string[]} groups - List of icon groups
 */
function generateVersionFile(outRoot, totalIcons, groups) {
  const version = {
    generated: new Date().toISOString(),
    totalIcons,
    groups: groups.length,
    groupNames: groups,
  };

  const versionContent = `/// AirQO Icons Library Version Information
/// 
/// This file contains metadata about the generated icon library.

library airqo_icons_version;

/// Library version information
class AirQOIconsVersion {
  /// Date when the icons were generated
  static const String generated = '${version.generated}';
  
  /// Total number of icons in the library
  static const int totalIcons = ${version.totalIcons};
  
  /// Number of icon groups
  static const int totalGroups = ${version.groups};
  
  /// List of available icon groups
  static const List<String> groups = ${JSON.stringify(version.groupNames, null, 2)};
}`;

  fs.writeFileSync(path.join(outRoot, 'version.dart'), versionContent);
}

/**
 * Main Flutter generator function
 */
async function generateFlutterIcons() {
  const iconRoot = path.join(__dirname, '../../packages/core/src/icons');
  const outRoot = path.join(__dirname, '../../packages/flutter/lib/src');

  console.log('🚀 Starting Flutter icon generation...');

  // Clean output directory
  if (fs.existsSync(outRoot)) {
    fs.rmSync(outRoot, { force: true, recursive: true });
  }

  // Validate icon root directory
  if (!fs.existsSync(iconRoot)) {
    console.error(`❌ Icon root directory not found: ${iconRoot}`);
    process.exit(1);
  }

  const groups = fs
    .readdirSync(iconRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  if (groups.length === 0) {
    console.warn('⚠️  No icon groups found');
    return;
  }

  console.log(`📦 Processing ${groups.length} icon groups...`);

  let totalIcons = 0;
  const processedGroups = [];
  const groupExports = [];

  for (const group of groups) {
    try {
      const result = processIconGroup(iconRoot, outRoot, group);
      totalIcons += result.count;

      if (result.count > 0) {
        processedGroups.push(group);
        groupExports.push(...result.exports);
      }
    } catch (error) {
      console.error(`❌ Failed to process group ${group}:`, error.message);
      continue;
    }
  }

  // Create main library barrel file with comprehensive documentation
  const mainLibraryContent = `/// AirQO Icons Library
/// 
/// A comprehensive Flutter icon library with ${totalIcons} SVG icons
/// organized into ${processedGroups.length} categories.
/// 
/// ## Usage
/// 
/// Import the library:
/// \`\`\`dart
/// import 'package:airqo_icons/airqo_icons.dart';
/// \`\`\`
/// 
/// Use an icon widget:
/// \`\`\`dart
/// Widget build(BuildContext context) {
///   return SomeIconWidget(
///     size: 32,
///     color: Colors.blue,
///   );
/// }
/// \`\`\`
/// 
/// ## Available Groups
/// ${processedGroups
    .map((group) => `/// - ${group.charAt(0).toUpperCase() + group.slice(1)}`)
    .join('\n')}

library airqo_icons;

// Icon groups
${groupExports.join('\n')}

// Version information
export 'version.dart';
`;

  fs.writeFileSync(path.join(outRoot, 'airqo_icons.dart'), mainLibraryContent);

  // Generate version file
  generateVersionFile(outRoot, totalIcons, processedGroups);

  console.log(`✅ Flutter icons generated successfully!`);
  console.log(`📊 Total: ${totalIcons} icons across ${processedGroups.length} groups`);
  console.log(`📁 Output directory: ${outRoot}`);
}

// Execute if called directly
if (require.main === module) {
  generateFlutterIcons().catch((error) => {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  });
}

module.exports = {
  generateFlutterIcons,
  toPascalCase,
  toSnakeCase,
  extractSvgContent,
  generateFlutterWidget,
  cleanSvgForDart,
  processGroupRecursively,
  processSvgFiles,
  getSvgFiles,
  getSubdirectories,
};
