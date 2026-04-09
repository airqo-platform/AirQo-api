import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('AirQO Icons Core', () => {
  const iconsDir = path.join(__dirname, '../icons');

  test('icons directory exists', () => {
    expect(fs.existsSync(iconsDir)).toBe(true);
  });

  test('has expected icon categories', () => {
    const categories = fs
      .readdirSync(iconsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const expectedCategories = [
      'Airqo',
      'Alerts_Feedback',
      'Arrows',
      'Charts',
      'Communication',
      'Development',
      'Editor',
      'Education',
      'Files',
      'Finance_eCommerce',
      'Flags',
      'General',
      'Images',
      'Layout',
      'Maps_Travel',
      'Media_devices',
      'Security',
      'Shapes',
      'Time',
      'Users',
      'Weather',
    ];

    expectedCategories.forEach((category) => {
      expect(categories).toContain(category);
    });
  });

  test('all SVG files are valid', () => {
    const walkDir = (dir: string): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (item.name.endsWith('.svg')) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const svgFiles = walkDir(iconsDir);
    expect(svgFiles.length).toBeGreaterThan(1000); // Should have many icons

    // Test a few SVG files for valid XML structure
    svgFiles.slice(0, 10).forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('<svg');
      expect(content).toContain('</svg>');
      expect(content).toContain('viewBox=');
    });
  });

  test('SVG files have consistent naming', () => {
    const walkDir = (dir: string): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (item.name.endsWith('.svg')) {
          files.push(item.name);
        }
      }

      return files;
    };

    const svgFiles = walkDir(iconsDir);

    svgFiles.forEach((filename) => {
      // Should be kebab-case or Pascal-case with numbers
      expect(filename).toMatch(/^[A-Za-z0-9-_]+\.svg$/);
    });
  });
});
