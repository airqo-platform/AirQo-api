# @airqo/icons-react

<div align="center">

![AirQO Icons](https://img.shields.io/badge/AirQO-Icons-blue?style=for-the-badge&logo=react)

**Production-ready React icon library with 1,383+ optimized SVG icons**

[![npm version](https://img.shields.io/npm/v/@airqo/icons-react?style=flat-square)](https://www.npmjs.com/package/@airqo/icons-react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@airqo/icons-react?style=flat-square)](https://bundlephobia.com/package/@airqo/icons-react)
[![downloads](https://img.shields.io/npm/dm/@airqo/icons-react?style=flat-square)](https://www.npmjs.com/package/@airqo/icons-react)
[![license](https://img.shields.io/npm/l/@airqo/icons-react?style=flat-square)](https://github.com/airqo-platform/airqo-libraries/blob/main/LICENSE)

[Getting Started](#-getting-started) • [Documentation](#-documentation) • [Icon Browser](https://airqo-icons.vercel.app) • [Examples](#-examples)

</div>

---

## ✨ Why AirQO Icons?

- **🎯 Comprehensive** - 1,383 carefully crafted icons across 22 categories
- **⚡ Performance First** - Tree-shakable with 2-4KB per icon
- **🔍 Smart Search** - AI-powered fuzzy search with Fuse.js
- **📱 Modern React** - Hooks, TypeScript, SSR ready
- **🎨 Fully Customizable** - Size, color, className support
- **🌍 Global Ready** - 196+ country flags included

## 🚀 Getting Started

```bash
# Install the package
npm install @airqo/icons-react

# For advanced search features (optional)
npm install fuse.js
```

```tsx
import { AqHome01, AqUser01, AqUganda } from '@airqo/icons-react';

function App() {
  return (
    <div className="flex items-center gap-4">
      <AqHome01 size={24} className="text-blue-600" />
      <AqUser01 size={24} className="text-gray-600" />
      <AqUganda size={24} className="text-green-600" />
    </div>
  );
}
```

## 📚 Documentation

### Basic Usage

Every icon is a React component with consistent props:

```tsx
// Standard usage
<AqHome01 size={24} />

// With styling
<AqBarChart01
  size={32}
  className="text-purple-600 hover:text-purple-800"
/>

// With event handlers
<AqSettings01
  size={20}
  onClick={() => openSettings()}
  className="cursor-pointer"
/>
```

### Icon Props

```tsx
interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string; // Default: 24
  className?: string; // CSS classes
  color?: string; // Icon color
  // + all standard SVG props
}
```

### Smart Search & Discovery

```tsx
import { AirQOIconsUtils, useIconSearch } from '@airqo/icons-react';

// Quick search
const homeIcons = AirQOIconsUtils.searchIcons('home');

// Advanced search with filters
const chartIcons = AirQOIconsUtils.searchIcons('chart', {
  maxResults: 10,
  groupFilter: ['Charts', 'Analytics'],
});

// React hook for live search
function IconPicker() {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useIconSearch(query, {
    maxResults: 50,
    debounceMs: 300,
  });

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search 1,383 icons..."
      />
      <div className="grid grid-cols-8 gap-2">
        {results.map(({ name, component: Icon }) => (
          <Icon key={name} size={32} />
        ))}
      </div>
    </div>
  );
}
```

## 📊 Icon Categories

<details>
<summary><strong>View all 22 categories (1,383 icons)</strong></summary>

| Category         | Count | Examples                                      |
| ---------------- | ----- | --------------------------------------------- |
| 🏳️ Flags         | 196   | `AqUganda`, `AqUSA`, `AqJapan`, `AqUK`        |
| 🏠 General       | 197   | `AqHome01`, `AqSettings01`, `AqSearch`        |
| 📊 Charts        | 49    | `AqBarChart01`, `AqPieChart01`, `AqLineChart` |
| 💬 Communication | 58    | `AqMail01`, `AqPhone01`, `AqMessage`          |
| 💻 Development   | 57    | `AqCode01`, `AqGitBranch`, `AqTerminal`       |
| ✏️ Editor        | 104   | `AqBold01`, `AqItalic01`, `AqUnderline`       |
| 🎓 Education     | 31    | `AqBook01`, `AqGraduation`, `AqCertificate`   |
| 📄 Files         | 58    | `AqFile01`, `AqFolder`, `AqDownload`          |
| 💰 Finance       | 79    | `AqDollar`, `AqCard01`, `AqBank`              |
| 🗺️ Maps          | 42    | `AqPin01`, `AqNavigation`, `AqCompass`        |
| 🎵 Media         | 108   | `AqPlay`, `AqPause`, `AqVolume`               |
| 🔒 Security      | 36    | `AqLock01`, `AqShield01`, `AqKey01`           |

_...and 10 more categories_

</details>

## 🎨 Styling Examples

<details>
<summary><strong>Tailwind CSS</strong></summary>

```tsx
// Colors & states
<AqHome01 className="text-blue-500 hover:text-blue-700" />

// Sizes (prefer size prop)
<AqUser01 size={16} className="text-gray-400" />
<AqUser01 size={24} className="text-gray-600" />
<AqUser01 size={32} className="text-gray-800" />

// Effects & animations
<AqHeart01 className="text-red-500 hover:scale-110 transition-transform" />
<AqLoader className="animate-spin text-blue-500" />
```

</details>

<details>
<summary><strong>CSS-in-JS / Styled Components</strong></summary>

```tsx
import styled from 'styled-components';
import { AqHome01 } from '@airqo/icons-react';

const StyledIcon = styled(AqHome01)`
  color: ${(props) => props.theme.primary};
  transition: all 0.2s ease;

  &:hover {
    color: ${(props) => props.theme.primaryDark};
    transform: scale(1.05);
  }
`;
```

</details>

## 🛠️ Advanced Features

### Tree Shaking (Recommended)

```tsx
// ✅ Optimal - Only imports what you use (~4KB per icon)
import { AqHome01, AqUser01 } from '@airqo/icons-react';

// ❌ Avoid - Imports entire library (~6MB)
import * as Icons from '@airqo/icons-react';
```

### Dynamic Imports

```tsx
import { lazy, Suspense } from 'react';

const AqUganda = lazy(() =>
  import('@airqo/icons-react').then((mod) => ({ default: mod.AqUganda })),
);

function CountryFlag() {
  return (
    <Suspense fallback={<div className="w-6 h-6 bg-gray-200 rounded" />}>
      <AqUganda size={24} />
    </Suspense>
  );
}
```

### Custom Icon Wrapper

```tsx
interface IconButtonProps {
  icon: React.ComponentType<any>;
  label: string;
  onClick?: () => void;
}

function IconButton({ icon: Icon, label, onClick }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

// Usage
<IconButton icon={AqHome01} label="Home" onClick={() => navigate('/')} />;
```

## 🔧 TypeScript Support

Full TypeScript support with complete type definitions:

```tsx
import type { ComponentProps } from 'react';
import { AqHome01 } from '@airqo/icons-react';

// Fully typed icon props
type IconProps = ComponentProps<typeof AqHome01>;

// Type-safe icon component
interface NavigationItemProps {
  icon: React.ComponentType<ComponentProps<'svg'>>;
  label: string;
  active?: boolean;
}

function NavigationItem({ icon: Icon, label, active }: NavigationItemProps) {
  return (
    <div className={`flex items-center gap-3 ${active ? 'text-blue-600' : 'text-gray-600'}`}>
      <Icon size={20} />
      <span>{label}</span>
    </div>
  );
}
```

## 📈 Performance

| Metric               | Value                        |
| -------------------- | ---------------------------- |
| Bundle size per icon | 2-4KB                        |
| Tree-shaking         | ✅ Full support              |
| SSR compatible       | ✅ React 18+                 |
| TypeScript           | ✅ Complete types            |
| Zero dependencies    | ✅ (except optional fuse.js) |

## 🌟 Examples

### Icon Picker Component

```tsx
import { useState } from 'react';
import { useIconSearch, AirQOIconsUtils } from '@airqo/icons-react';

function IconPicker({ onSelect }: { onSelect: (icon: string) => void }) {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useIconSearch(query);

  return (
    <div className="p-4 border rounded-lg">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons..."
        className="w-full p-2 border rounded mb-4"
      />

      {isLoading ? (
        <div>Searching...</div>
      ) : (
        <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
          {results.map(({ name, component: Icon }) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="p-2 hover:bg-gray-100 rounded"
              title={name}
            >
              <Icon size={24} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Navigation with Icons

```tsx
const navigationItems = [
  { icon: AqHome01, label: 'Dashboard', path: '/' },
  { icon: AqBarChart01, label: 'Analytics', path: '/analytics' },
  { icon: AqUser01, label: 'Profile', path: '/profile' },
  { icon: AqSettings01, label: 'Settings', path: '/settings' },
];

function Sidebar() {
  return (
    <nav className="w-64 bg-white border-r">
      {navigationItems.map(({ icon: Icon, label, path }) => (
        <a key={path} href={path} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
          <Icon size={20} className="text-gray-600" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
```

## 🔗 Resources

- **[🐛 Report Issues](https://github.com/airqo-platform/airqo-libraries/issues)**
- **[💬 Discussions](https://github.com/airqo-platform/airqo-libraries/discussions)**

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](https://github.com/airqo-platform/airqo-libraries/blob/main/CONTRIBUTING.md) to get started.

## 📄 License

MIT © [AirQo Organization](https://github.com/airqo-platform)

---

<div align="center">

**Built with ❤️ by the AirQo team**

[Website](https://airqo.net) • [GitHub](https://github.com/airqo-platform) • [Twitter](https://twitter.com/airqo)

</div>
