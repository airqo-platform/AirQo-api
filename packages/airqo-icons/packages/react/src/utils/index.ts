// Auto-generated utility functions for AirQO Icons
import React from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * Icon metadata interface with enhanced search capabilities
 */
export interface IconMetadata {
  /** The icon name with Aq prefix (e.g., AqHome01) */
  name: string;
  /** The original icon name without prefix for backward compatibility */
  originalName?: string;
  /** Primary group categorization */
  group: string;
  /** Optional subgroup within the main group */
  subgroup?: string;
  /** Searchable tags and keywords */
  tags: string[];
  /** React component for the icon */
  component: React.ComponentType<any>;
  /** Icon description for accessibility and search */
  description?: string;
  /** Icon variant/style information */
  variant?: string;
  /** Keywords derived from the icon name and group */
  keywords: string[];
}

/**
 * Search result interface with enhanced metadata
 */
export interface SearchResult extends IconMetadata {
  /** Search relevance score (0-1) */
  score?: number;
  /** Matched search terms */
  matches?: string[];
}

/**
 * Icon group interface for better organization
 */
export interface IconGroup {
  name: string;
  displayName: string;
  description: string;
  iconCount: number;
  subgroups: string[];
}

/**
 * Enhanced search and filter utilities for AirQO Icons with Fuse.js integration
 */
export class AirQOIconsUtils {
  private static iconRegistry: Map<string, IconMetadata> = new Map();
  private static fuseInstance: Fuse<IconMetadata> | null = null;
  private static groupRegistry: Map<string, IconGroup> = new Map();

  /**
   * Fuse.js configuration for optimal icon search
   */
  private static readonly FUSE_CONFIG: IFuseOptions<IconMetadata> = {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'originalName', weight: 0.3 },
      { name: 'group', weight: 0.2 },
      { name: 'subgroup', weight: 0.15 },
      { name: 'tags', weight: 0.25 },
      { name: 'description', weight: 0.2 },
      { name: 'keywords', weight: 0.3 },
    ],
    threshold: 0.4, // Lower threshold for more precise matches
    distance: 100,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 2,
  };

  /**
   * Initialize or reinitialize the Fuse.js search instance
   */
  private static initializeFuse(): void {
    const icons = Array.from(this.iconRegistry.values());
    this.fuseInstance = new Fuse(icons, this.FUSE_CONFIG);
  }

  /**
   * Convert icon name to Aq prefixed format
   */
  static formatIconName(originalName: string): string {
    // Remove common prefixes and clean up
    const cleaned = originalName
      .replace(/^(icon|Icon|ICON)/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^\d+/, ''); // Remove leading numbers

    // Convert to PascalCase
    const pascalCase = cleaned
      .replace(/(?:^|-)([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/([a-z])([A-Z])/g, '$1$2');

    return `Aq${pascalCase}`;
  }

  /**
   * Generate comprehensive keywords for an icon
   */
  static generateKeywords(name: string, group: string, tags: string[]): string[] {
    const keywords = new Set<string>();

    // Add variations of the name
    const cleanName = name.replace(/^Aq/, '').toLowerCase();
    keywords.add(cleanName);

    // Add group-based keywords
    keywords.add(group.toLowerCase());

    // Add tag-based keywords
    tags.forEach((tag) => keywords.add(tag.toLowerCase()));

    // Add common synonyms based on group
    const synonyms = this.getGroupSynonyms(group);
    synonyms.forEach((synonym) => keywords.add(synonym));

    // Add number variations (01, 02, etc.)
    const numberMatch = name.match(/(\d+)$/);
    if (numberMatch) {
      keywords.add(numberMatch[1]);
      keywords.add(`0${numberMatch[1]}`);
    }

    return Array.from(keywords);
  }

  /**
   * Get synonyms for common icon groups
   */
  private static getGroupSynonyms(group: string): string[] {
    const synonymMap: Record<string, string[]> = {
      General: ['common', 'basic', 'essential', 'ui', 'interface'],
      Arrows: ['direction', 'navigation', 'pointer', 'chevron'],
      Charts: ['graph', 'analytics', 'data', 'visualization', 'stats'],
      Communication: ['chat', 'message', 'social', 'contact', 'network'],
      Files: ['document', 'folder', 'storage', 'data', 'export'],
      Users: ['person', 'profile', 'account', 'people', 'team'],
      Time: ['clock', 'calendar', 'schedule', 'date', 'timer'],
      Weather: ['climate', 'forecast', 'atmosphere', 'temperature'],
      Security: ['lock', 'protection', 'safety', 'shield', 'privacy'],
      Education: ['learning', 'school', 'academic', 'study', 'knowledge'],
    };

    return synonymMap[group] || [];
  }

  /**
   * Register an icon with enhanced metadata
   */
  static registerIcon(metadata: Omit<IconMetadata, 'keywords'>): void {
    const enhancedMetadata: IconMetadata = {
      ...metadata,
      keywords: this.generateKeywords(metadata.name, metadata.group, metadata.tags),
    };

    this.iconRegistry.set(enhancedMetadata.name, enhancedMetadata);

    // Update group registry
    this.updateGroupRegistry(enhancedMetadata);

    // Reinitialize Fuse instance
    this.fuseInstance = null;
  }

  /**
   * Update group registry with icon information
   */
  private static updateGroupRegistry(icon: IconMetadata): void {
    const groupName = icon.group;
    let group = this.groupRegistry.get(groupName);

    if (!group) {
      group = {
        name: groupName,
        displayName: this.formatGroupDisplayName(groupName),
        description: this.getGroupDescription(groupName),
        iconCount: 0,
        subgroups: [],
      };
    }

    group.iconCount = this.getIconsByGroup(groupName).length + 1;

    if (icon.subgroup && !group.subgroups.includes(icon.subgroup)) {
      group.subgroups.push(icon.subgroup);
      group.subgroups.sort();
    }

    this.groupRegistry.set(groupName, group);
  }

  /**
   * Format group name for display
   */
  private static formatGroupDisplayName(groupName: string): string {
    return groupName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  }

  /**
   * Get description for icon groups
   */
  private static getGroupDescription(groupName: string): string {
    const descriptions: Record<string, string> = {
      General: 'Common user interface icons for general purposes',
      Arrows: 'Directional icons and navigation elements',
      Charts: 'Data visualization and analytics icons',
      Communication: 'Social media, messaging, and communication icons',
      Files: 'File management, documents, and storage icons',
      Users: 'User profiles, people, and team-related icons',
      Time: 'Time, date, calendar, and scheduling icons',
      Weather: 'Weather conditions and climate-related icons',
      Security: 'Security, privacy, and protection icons',
      Education: 'Educational and learning-related icons',
      Finance_eCommerce: 'Financial and e-commerce icons',
      Maps_Travel: 'Location, travel, and navigation icons',
      Media_devices: 'Media players and device icons',
      Development: 'Development tools and programming icons',
      Editor: 'Text editing and formatting icons',
      Images: 'Image manipulation and gallery icons',
      Layout: 'Layout and design structure icons',
      Shapes: 'Geometric shapes and design elements',
      Alerts_Feedback: 'Alerts, notifications, and feedback icons',
      Flags: 'Country flags and regional indicators',
      AeroGlyphs: 'Custom AirQo brand-specific icons',
      Airqo: 'AirQo brand and logo variations',
    };

    return descriptions[groupName] || `Icons related to ${groupName.toLowerCase()}`;
  }

  /**
   * Get all registered icons
   */
  static getAllIcons(): IconMetadata[] {
    return Array.from(this.iconRegistry.values());
  }

  /**
   * Advanced search icons using Fuse.js with enhanced capabilities
   */
  static searchIcons(
    query: string,
    options?: {
      maxResults?: number;
      groupFilter?: string[];
      includeScores?: boolean;
    },
  ): SearchResult[] {
    if (!query.trim()) {
      const allIcons = this.getAllIcons();
      return options?.groupFilter
        ? allIcons.filter((icon) => options.groupFilter!.includes(icon.group))
        : allIcons;
    }

    // Initialize Fuse if not already done
    if (!this.fuseInstance) {
      this.initializeFuse();
    }

    const results = this.fuseInstance!.search(query);

    let searchResults: SearchResult[] = results.map((result) => ({
      ...result.item,
      score: result.score,
      matches: (result.matches?.map((match) => match.key).filter(Boolean) as string[]) || [],
    }));

    // Apply group filter if specified
    if (options?.groupFilter) {
      searchResults = searchResults.filter((result) => options.groupFilter!.includes(result.group));
    }

    // Limit results if specified
    if (options?.maxResults) {
      searchResults = searchResults.slice(0, options.maxResults);
    }

    return searchResults;
  }

  /**
   * Fuzzy search with intelligent suggestions
   */
  static intelligentSearch(query: string): {
    exactMatches: SearchResult[];
    fuzzyMatches: SearchResult[];
    suggestions: string[];
  } {
    const exactMatches = this.searchIcons(query, { maxResults: 10 }).filter(
      (result) => (result.score || 0) < 0.1,
    );

    const fuzzyMatches = this.searchIcons(query, { maxResults: 20 }).filter(
      (result) => (result.score || 0) >= 0.1,
    );

    // Generate suggestions based on popular icons and similar terms
    const suggestions = this.generateSearchSuggestions(query);

    return {
      exactMatches,
      fuzzyMatches,
      suggestions: suggestions.slice(0, 5),
    };
  }

  /**
   * Generate search suggestions based on query
   */
  private static generateSearchSuggestions(query: string): string[] {
    const suggestions = new Set<string>();
    const allIcons = this.getAllIcons();

    // Add similar icon names
    allIcons.forEach((icon) => {
      if (
        icon.name.toLowerCase().includes(query.toLowerCase()) ||
        icon.keywords.some((keyword) => keyword.includes(query.toLowerCase()))
      ) {
        icon.keywords.forEach((keyword) => suggestions.add(keyword));
        suggestions.add(icon.group.toLowerCase());
      }
    });

    // Add common search terms
    const commonTerms = ['home', 'user', 'arrow', 'chart', 'file', 'time', 'search', 'settings'];
    commonTerms.forEach((term) => {
      if (term.includes(query.toLowerCase()) || query.toLowerCase().includes(term)) {
        suggestions.add(term);
      }
    });

    return Array.from(suggestions);
  }

  /**
   * Get icons by group with optional sorting
   */
  static getIconsByGroup(group: string, sortBy?: 'name' | 'popularity'): IconMetadata[] {
    const icons = this.getAllIcons().filter((icon) => icon.group === group);

    if (sortBy === 'name') {
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }

    return icons;
  }

  /**
   * Get all groups with enhanced metadata
   */
  static getAllGroups(): IconGroup[] {
    // Ensure all groups are in registry
    this.getAllIcons().forEach((icon) => this.updateGroupRegistry(icon));
    return Array.from(this.groupRegistry.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  /**
   * Get group names only (for backward compatibility)
   */
  static getAllGroupNames(): string[] {
    return this.getAllGroups().map((group) => group.name);
  }

  /**
   * Get group by name
   */
  static getGroup(groupName: string): IconGroup | undefined {
    return this.groupRegistry.get(groupName);
  }

  /**
   * Get subgroups for a specific group
   */
  static getSubgroups(group: string): string[] {
    const groupData = this.groupRegistry.get(group);
    return groupData?.subgroups || [];
  }

  /**
   * Get popular icons (most commonly used)
   */
  static getPopularIcons(limit: number = 20): IconMetadata[] {
    // For now, return commonly used icons based on name patterns
    const popularPatterns = [
      /^AqHome/i,
      /^AqUser/i,
      /^AqSearch/i,
      /^AqSettings/i,
      /^AqArrow/i,
      /^AqChart/i,
      /^AqFile/i,
      /^AqHeart/i,
      /^AqStar/i,
      /^AqCheck/i,
      /^AqPlus/i,
      /^AqMinus/i,
      /^AqX/i,
      /^AqDownload/i,
      /^AqUpload/i,
    ];

    const popular = this.getAllIcons().filter((icon) =>
      popularPatterns.some((pattern) => pattern.test(icon.name)),
    );

    return popular.slice(0, limit);
  }

  /**
   * Get recently added icons (based on registration order)
   */
  static getRecentIcons(limit: number = 10): IconMetadata[] {
    const allIcons = this.getAllIcons();
    return allIcons.slice(-limit).reverse();
  }

  /**
   * Get icon by name (with or without Aq prefix)
   */
  static getIcon(name: string): IconMetadata | undefined {
    // Try with exact name first
    let icon = this.iconRegistry.get(name);

    // If not found and doesn't start with Aq, try adding prefix
    if (!icon && !name.startsWith('Aq')) {
      icon = this.iconRegistry.get(`Aq${name}`);
    }

    // If still not found, try with original name lookup
    if (!icon) {
      const allIcons = this.getAllIcons();
      icon = allIcons.find((i) => i.originalName === name);
    }

    return icon;
  }

  /**
   * Get icons by tags
   */
  static getIconsByTags(tags: string[]): IconMetadata[] {
    return this.getAllIcons().filter((icon) =>
      tags.some((tag) => icon.tags.includes(tag) || icon.keywords.includes(tag.toLowerCase())),
    );
  }

  /**
   * Get similar icons based on an icon
   */
  static getSimilarIcons(iconName: string, limit: number = 5): IconMetadata[] {
    const icon = this.getIcon(iconName);
    if (!icon) return [];

    const similar = this.getAllIcons()
      .filter((i) => i.name !== icon.name)
      .filter(
        (i) =>
          i.group === icon.group ||
          i.tags.some((tag) => icon.tags.includes(tag)) ||
          i.keywords.some((keyword) => icon.keywords.includes(keyword)),
      )
      .slice(0, limit);

    return similar;
  }

  /**
   * Generate optimized SVG string for an icon
   */
  static async generateSVG(
    iconName: string,
    options: {
      size?: number;
      color?: string;
      strokeWidth?: number;
      className?: string;
    } = {},
  ): Promise<string> {
    const { size = 24, color = 'currentColor', strokeWidth = 1.5, className = '' } = options;

    const icon = this.getIcon(iconName);
    if (!icon) {
      throw new Error(`Icon "${iconName}" not found`);
    }

    // For now, return a placeholder SVG. In a real implementation,
    // you'd render the React component to SVG using libraries like react-dom/server
    return `<svg 
      width="${size}" 
      height="${size}" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="${color}"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="${className}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Icon: ${iconName} from ${icon.group} group -->
      <!-- Actual SVG content would be rendered here -->
    </svg>`;
  }

  /**
   * Export icons data for external use
   */
  static exportIconsData(): {
    icons: IconMetadata[];
    groups: IconGroup[];
    stats: any;
  } {
    return {
      icons: this.getAllIcons(),
      groups: this.getAllGroups(),
      stats: this.getStats(),
    };
  }

  /**
   * Validate icon name format
   */
  static validateIconName(name: string): {
    isValid: boolean;
    formattedName: string;
    issues: string[];
  } {
    const issues: string[] = [];
    let formattedName = name;

    if (!name.startsWith('Aq')) {
      issues.push('Icon name should start with "Aq" prefix');
      formattedName = this.formatIconName(name);
    }

    if (!/^Aq[A-Z]/.test(name)) {
      issues.push('Icon name should use PascalCase after "Aq" prefix');
    }

    if (name.length < 3) {
      issues.push('Icon name too short');
    }

    return {
      isValid: issues.length === 0,
      formattedName,
      issues,
    };
  }

  /**
   * Get comprehensive usage statistics
   */
  static getStats() {
    const icons = this.getAllIcons();
    const groups = this.getAllGroups();

    const groupCounts = groups.reduce((acc, group) => {
      acc[group.name] = group.iconCount;
      return acc;
    }, {} as Record<string, number>);

    const tagFrequency = icons.reduce((acc, icon) => {
      icon.tags.forEach((tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const keywordFrequency = icons.reduce((acc, icon) => {
      icon.keywords.forEach((keyword) => {
        acc[keyword] = (acc[keyword] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIcons: icons.length,
      totalGroups: groups.length,
      groupCounts,
      groups: groups.map((g) => g.name),
      mostPopularTags: Object.entries(tagFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag),
      mostPopularKeywords: Object.entries(keywordFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([keyword]) => keyword),
      averageIconsPerGroup: Math.round(icons.length / groups.length),
      hasSubgroups: groups.filter((g) => g.subgroups.length > 0).length,
    };
  }

  /**
   * Clear all registered icons (useful for testing)
   */
  static clear(): void {
    this.iconRegistry.clear();
    this.groupRegistry.clear();
    this.fuseInstance = null;
  }

  /**
   * Bulk register multiple icons
   */
  static registerIcons(icons: Omit<IconMetadata, 'keywords'>[]): void {
    icons.forEach((icon) => this.registerIcon(icon));
  }
}

/**
 * Enhanced React hooks for icon management with optimized performance
 */

/**
 * Hook for intelligent icon search with debouncing
 */
export function useIconSearch(
  query: string,
  options?: {
    debounceMs?: number;
    maxResults?: number;
    groupFilter?: string[];
  },
) {
  const { debounceMs = 300, maxResults = 50, groupFilter } = options || {};
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounced search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      setError(null);

      try {
        if (!query.trim()) {
          const allIcons = AirQOIconsUtils.getAllIcons();
          const filteredIcons = groupFilter
            ? allIcons.filter((icon) => groupFilter.includes(icon.group))
            : allIcons;
          setResults(filteredIcons.slice(0, maxResults));
        } else {
          const searchResults = AirQOIconsUtils.searchIcons(query, {
            maxResults,
            groupFilter,
            includeScores: true,
          });
          setResults(searchResults);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, debounceMs, maxResults, groupFilter]);

  return { results, isLoading, error };
}

/**
 * Hook for intelligent search with suggestions
 */
export function useIntelligentSearch(query: string) {
  const [searchData, setSearchData] = React.useState({
    exactMatches: [] as SearchResult[],
    fuzzyMatches: [] as SearchResult[],
    suggestions: [] as string[],
  });

  React.useEffect(() => {
    if (!query.trim()) {
      setSearchData({
        exactMatches: [],
        fuzzyMatches: [],
        suggestions: [],
      });
      return;
    }

    const results = AirQOIconsUtils.intelligentSearch(query);
    setSearchData(results);
  }, [query]);

  return searchData;
}

/**
 * Hook for getting icons by group with caching
 */
export function useIconsByGroup(group: string, sortBy?: 'name' | 'popularity') {
  const [icons, setIcons] = React.useState<IconMetadata[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const groupIcons = AirQOIconsUtils.getIconsByGroup(group, sortBy);
    setIcons(groupIcons);
    setIsLoading(false);
  }, [group, sortBy]);

  return { icons, isLoading };
}

/**
 * Hook for getting all icon groups with metadata
 */
export function useIconGroups() {
  const [groups, setGroups] = React.useState<IconGroup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const allGroups = AirQOIconsUtils.getAllGroups();
    setGroups(allGroups);
    setIsLoading(false);
  }, []);

  return { groups, isLoading };
}

/**
 * Hook for getting popular icons
 */
export function usePopularIcons(limit: number = 20) {
  const [icons, setIcons] = React.useState<IconMetadata[]>([]);

  React.useEffect(() => {
    const popularIcons = AirQOIconsUtils.getPopularIcons(limit);
    setIcons(popularIcons);
  }, [limit]);

  return icons;
}

/**
 * Hook for getting recent icons
 */
export function useRecentIcons(limit: number = 10) {
  const [icons, setIcons] = React.useState<IconMetadata[]>([]);

  React.useEffect(() => {
    const recentIcons = AirQOIconsUtils.getRecentIcons(limit);
    setIcons(recentIcons);
  }, [limit]);

  return icons;
}

/**
 * Hook for getting similar icons
 */
export function useSimilarIcons(iconName: string, limit: number = 5) {
  const [icons, setIcons] = React.useState<IconMetadata[]>([]);

  React.useEffect(() => {
    if (!iconName) {
      setIcons([]);
      return;
    }

    const similarIcons = AirQOIconsUtils.getSimilarIcons(iconName, limit);
    setIcons(similarIcons);
  }, [iconName, limit]);

  return icons;
}

/**
 * Hook for getting icon statistics
 */
export function useIconStats() {
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    const iconStats = AirQOIconsUtils.getStats();
    setStats(iconStats);
  }, []);

  return stats;
}

/**
 * Hook for getting a specific icon
 */
export function useIcon(iconName: string) {
  const [icon, setIcon] = React.useState<IconMetadata | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const foundIcon = AirQOIconsUtils.getIcon(iconName) || null;
    setIcon(foundIcon);
    setIsLoading(false);
  }, [iconName]);

  return { icon, isLoading };
}

/**
 * Hook for validating icon names
 */
export function useIconValidation(iconName: string) {
  const [validation, setValidation] = React.useState<{
    isValid: boolean;
    formattedName: string;
    issues: string[];
  } | null>(null);

  React.useEffect(() => {
    if (!iconName) {
      setValidation(null);
      return;
    }

    const validationResult = AirQOIconsUtils.validateIconName(iconName);
    setValidation(validationResult);
  }, [iconName]);

  return validation;
}

// Export the enhanced utilities as default
export { AirQOIconsUtils as default };
