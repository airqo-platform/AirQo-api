import { describe, it, expect } from 'vitest';
import { iconGroups, totalIcons, allIconNames, version } from '../index';

describe('Vue Package Utilities', () => {
  it('should export version information', () => {
    expect(version).toBe('0.1.0');
    expect(typeof version).toBe('string');
  });

  it('should export icon groups', () => {
    expect(Array.isArray(iconGroups)).toBe(true);
    expect(iconGroups.length).toBeGreaterThan(0);
    expect(iconGroups).toContain('General');
    expect(iconGroups).toContain('Arrows');
  });

  it('should export total icons count', () => {
    expect(typeof totalIcons).toBe('number');
    expect(totalIcons).toBeGreaterThan(0);
    expect(totalIcons).toBe(1383);
  });

  it('should export all icon names', () => {
    expect(Array.isArray(allIconNames)).toBe(true);
    expect(allIconNames.length).toBe(totalIcons);
    expect(allIconNames.every((name) => name.startsWith('Aq'))).toBe(true);
  });

  it('should have consistent icon naming', () => {
    const sampleIcons = allIconNames.slice(0, 10);
    sampleIcons.forEach((iconName) => {
      expect(iconName).toMatch(/^Aq[A-Z][a-zA-Z0-9]*$/);
    });
  });

  it('should have proper icon groups structure', () => {
    expect(iconGroups).toEqual(
      expect.arrayContaining([
        'AeroGlyphs',
        'Airqo',
        'Alerts_Feedback',
        'Arrows',
        'Charts',
        'Communication',
        'General',
      ]),
    );
  });

  it('should export valid metadata', () => {
    expect(iconGroups.length).toBeGreaterThan(20);
    expect(totalIcons).toBeGreaterThan(1000);
    expect(allIconNames.length).toBe(totalIcons);
  });
});
