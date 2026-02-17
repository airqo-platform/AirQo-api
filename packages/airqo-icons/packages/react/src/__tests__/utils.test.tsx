import React from 'react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import AirQOIconsUtils, {
  useIconSearch,
  useIconsByGroup,
  useIconGroups,
  usePopularIcons,
  useIcon,
  useIconValidation,
  type IconMetadata,
} from '../utils';

// Mock icon component for testing
const MockIcon = React.forwardRef<SVGSVGElement, any>((props, ref) => (
  <svg ref={ref} {...props}>
    <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z" />
  </svg>
));
MockIcon.displayName = 'MockIcon';

describe('AirQOIconsUtils', () => {
  beforeEach(() => {
    // Clear the registry before each test
    AirQOIconsUtils.clear();
  });

  describe('Icon Registration', () => {
    test('should register icon with enhanced metadata', () => {
      const iconMetadata: Omit<IconMetadata, 'keywords'> = {
        name: 'AqHome01',
        originalName: 'Home01',
        group: 'General',
        tags: ['home', 'house', 'building'],
        component: MockIcon,
        description: 'Home icon from general collection',
      };

      AirQOIconsUtils.registerIcon(iconMetadata);
      const registeredIcon = AirQOIconsUtils.getIcon('AqHome01');

      expect(registeredIcon).toBeDefined();
      expect(registeredIcon?.name).toBe('AqHome01');
      expect(registeredIcon?.group).toBe('General');
      expect(registeredIcon?.keywords).toContain('home');
    });

    test('should generate keywords automatically', () => {
      const iconMetadata: Omit<IconMetadata, 'keywords'> = {
        name: 'AqUser01',
        group: 'Users',
        tags: ['profile', 'person'],
        component: MockIcon,
      };

      AirQOIconsUtils.registerIcon(iconMetadata);
      const registeredIcon = AirQOIconsUtils.getIcon('AqUser01');

      expect(registeredIcon?.keywords).toContain('user01');
      expect(registeredIcon?.keywords).toContain('users');
      expect(registeredIcon?.keywords).toContain('profile');
      expect(registeredIcon?.keywords).toContain('person');
    });
  });

  describe('Icon Search', () => {
    beforeEach(() => {
      // Register test icons
      const testIcons: Omit<IconMetadata, 'keywords'>[] = [
        {
          name: 'AqHome01',
          originalName: 'Home01',
          group: 'General',
          tags: ['home', 'house'],
          component: MockIcon,
        },
        {
          name: 'AqUser01',
          group: 'Users',
          tags: ['profile', 'person'],
          component: MockIcon,
        },
        {
          name: 'AqChart01',
          group: 'Charts',
          tags: ['graph', 'data'],
          component: MockIcon,
        },
      ];

      AirQOIconsUtils.registerIcons(testIcons);
    });

    test('should search icons by name', () => {
      const results = AirQOIconsUtils.searchIcons('AqHome');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('AqHome01');
    });

    test('should search icons by tag', () => {
      const results = AirQOIconsUtils.searchIcons('profile');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((icon) => icon.name === 'AqUser01')).toBe(true);
    });

    test('should provide intelligent search with suggestions', () => {
      const results = AirQOIconsUtils.intelligentSearch('home');
      expect(results.exactMatches.length + results.fuzzyMatches.length).toBeGreaterThan(0);
      expect(results.suggestions).toBeInstanceOf(Array);
    });

    test('should filter by group', () => {
      const results = AirQOIconsUtils.searchIcons('', {
        groupFilter: ['Users'],
        maxResults: 10,
      });
      expect(results.every((icon) => icon.group === 'Users')).toBe(true);
    });
  });

  describe('Icon Groups', () => {
    beforeEach(() => {
      AirQOIconsUtils.registerIcon({
        name: 'AqHome01',
        group: 'General',
        tags: ['home'],
        component: MockIcon,
      });
    });

    test('should get icons by group', () => {
      const generalIcons = AirQOIconsUtils.getIconsByGroup('General');
      expect(generalIcons.length).toBe(1);
      expect(generalIcons[0].name).toBe('AqHome01');
    });

    test('should get all groups with metadata', () => {
      const groups = AirQOIconsUtils.getAllGroups();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]).toHaveProperty('name');
      expect(groups[0]).toHaveProperty('displayName');
      expect(groups[0]).toHaveProperty('iconCount');
    });
  });

  describe('Icon Name Validation', () => {
    test('should validate correct icon names', () => {
      const validation = AirQOIconsUtils.validateIconName('AqHome01');
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should flag invalid icon names', () => {
      const validation = AirQOIconsUtils.validateIconName('Home01');
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Icon name should start with "Aq" prefix');
      expect(validation.formattedName).toBe('AqHome01');
    });

    test('should format icon names correctly', () => {
      const formatted = AirQOIconsUtils.formatIconName('home-icon-01');
      expect(formatted).toBe('AqHomeicon01');
    });
  });

  describe('Icon Utilities', () => {
    beforeEach(() => {
      const testIcons: Omit<IconMetadata, 'keywords'>[] = [
        {
          name: 'AqHome01',
          group: 'General',
          tags: ['home', 'popular'],
          component: MockIcon,
        },
        {
          name: 'AqUser01',
          group: 'Users',
          tags: ['user', 'popular'],
          component: MockIcon,
        },
      ];
      AirQOIconsUtils.registerIcons(testIcons);
    });

    test('should get icon by name with or without prefix', () => {
      expect(AirQOIconsUtils.getIcon('AqHome01')).toBeDefined();
      expect(AirQOIconsUtils.getIcon('Home01')).toBeDefined();
    });

    test('should get similar icons', () => {
      const similar = AirQOIconsUtils.getSimilarIcons('AqHome01', 3);
      expect(similar).toBeInstanceOf(Array);
      expect(similar.every((icon) => icon.name !== 'AqHome01')).toBe(true);
    });

    test('should get icons by tags', () => {
      const taggedIcons = AirQOIconsUtils.getIconsByTags(['popular']);
      expect(taggedIcons.length).toBe(2);
    });

    test('should generate statistics', () => {
      const stats = AirQOIconsUtils.getStats();
      expect(stats).toHaveProperty('totalIcons');
      expect(stats).toHaveProperty('totalGroups');
      expect(stats).toHaveProperty('groupCounts');
      expect(stats.totalIcons).toBe(2);
    });
  });
});

describe('React Hooks', () => {
  beforeEach(() => {
    AirQOIconsUtils.clear();
    const testIcons: Omit<IconMetadata, 'keywords'>[] = [
      {
        name: 'AqHome01',
        group: 'General',
        tags: ['home'],
        component: MockIcon,
      },
      {
        name: 'AqUser01',
        group: 'Users',
        tags: ['user'],
        component: MockIcon,
      },
    ];
    AirQOIconsUtils.registerIcons(testIcons);
  });

  test('useIconSearch should return search results', () => {
    const { result } = renderHook(() => useIconSearch('home'));

    // Wait for debounced search
    setTimeout(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
      expect(result.current.isLoading).toBe(false);
    }, 400);
  });

  test('useIconsByGroup should return icons for group', () => {
    const { result } = renderHook(() => useIconsByGroup('General'));
    expect(result.current.icons.length).toBe(1);
    expect(result.current.icons[0].name).toBe('AqHome01');
  });

  test('useIconGroups should return all groups', () => {
    const { result } = renderHook(() => useIconGroups());
    expect(result.current.groups.length).toBeGreaterThan(0);
    expect(result.current.isLoading).toBe(false);
  });

  test('useIcon should return specific icon', () => {
    const { result } = renderHook(() => useIcon('AqHome01'));
    expect(result.current.icon?.name).toBe('AqHome01');
    expect(result.current.isLoading).toBe(false);
  });

  test('useIconValidation should validate icon names', () => {
    const { result } = renderHook(() => useIconValidation('Home01'));
    expect(result.current?.isValid).toBe(false);
    expect(result.current?.formattedName).toBe('AqHome01');
  });

  test('usePopularIcons should return popular icons', () => {
    const { result } = renderHook(() => usePopularIcons(5));
    expect(result.current).toBeInstanceOf(Array);
  });
});
