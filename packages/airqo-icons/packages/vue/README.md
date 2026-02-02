# @airqo/icons-vue

<div align="center">

![AirQo Icons Vue](https://img.shields.io/badge/AirQo-Icons%20Vue-green?style=for-the-badge&logo=vue.js)

**Production-ready Vue 3 icon library with 1,383+ TypeScript components**

[![npm version](https://img.shields.io/npm/v/@airqo/icons-vue?style=flat-square)](https://www.npmjs.com/package/@airqo/icons-vue)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@airqo/icons-vue?style=flat-square)](https://bundlephobia.com/package/@airqo/icons-vue)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-green?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[Getting Started](#getting-started) • [Documentation](#api-reference) • [Icon Browser](https://aero-glyphs.vercel.app) • [Examples](#usage-examples)

</div>

---

## Features

- **🎯 Comprehensive** - 1,383 carefully crafted icons across 22 categories
- **⚡ Vue 3 Optimized** - Built with Composition API and `<script setup>`
- **🔍 Tree-shakable** - Import only what you need, ~6.4MB total
- **📱 SSR Ready** - Works with Nuxt.js and SSR frameworks
- **🎨 Fully Customizable** - Size, color, class support
- **🌍 Global Ready** - 196+ country flags included
- **💪 TypeScript** - Full type safety and IntelliSense

## Getting Started

### Installation

```bash
# npm
npm install @airqo/icons-vue

# yarn
yarn add @airqo/icons-vue

# pnpm
pnpm add @airqo/icons-vue
```

### Basic Usage

```vue
<template>
  <div class="flex items-center gap-4">
    <AqHome01 :size="24" class="text-blue-600" />
    <AqBarChart01 :size="32" color="#10b981" />
    <AqUganda :size="20" class="border rounded" />
  </div>
</template>

<script setup>
import { AqHome01, AqBarChart01, AqUganda } from '@airqo/icons-vue';
</script>
```

## API Reference

### Icon Props

All icon components accept these props:

```typescript
interface IconProps {
  size?: number | string; // Default: 24
  color?: string; // Default: 'currentColor'
  class?: string; // CSS classes
}
```

### Usage Examples

```vue
<template>
  <!-- Default size (24px) -->
  <AqHome01 />

  <!-- Custom size -->
  <AqBarChart01 :size="32" />
  <AqSettings01 size="2rem" />

  <!-- Custom color -->
  <AqHeart color="#ef4444" />
  <AqSun color="rgb(251, 191, 36)" />

  <!-- With CSS classes -->
  <AqSearch01 :size="20" class="text-gray-600 hover:text-gray-800 transition-colors" />

  <!-- Combining all props -->
  <AqNotification01 :size="28" color="#8b5cf6" class="animate-pulse" />
</template>
```

## Icon Categories

The library includes **1,383 icons** across **22 categories**:

| Category          | Count | Examples                                           |
| ----------------- | ----- | -------------------------------------------------- |
| **General**       | 197   | `AqHome01`, `AqSettings01`, `AqUser01`             |
| **Arrows**        | 92    | `AqArrowUp`, `AqChevronRight`, `AqRefreshCw01`     |
| **Charts**        | 49    | `AqBarChart01`, `AqLineChart01`, `AqPieChart01`    |
| **Communication** | 58    | `AqMail01`, `AqMessageCircle01`, `AqPhone`         |
| **Weather**       | 52    | `AqSun`, `AqCloud01`, `AqRain`, `AqSnowflake01`    |
| **Flags**         | 196   | `AqUganda`, `AqKenya`, `AqUnitedStates`            |
| **Finance**       | 79    | `AqCreditCard01`, `AqCurrencyDollar`, `AqWallet01` |
| **Development**   | 57    | `AqCode01`, `AqTerminal`, `AqGitBranch`            |
| **Files**         | 58    | `AqFile01`, `AqFolder01`, `AqDownload01`           |
| **Media**         | 108   | `AqPlay`, `AqPause`, `AqVolume01`                  |
| **+ 12 more**     | 437   | Maps, Security, Time, Users, etc.                  |

## Framework Integration

### Nuxt.js

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <h1 class="flex items-center gap-2">
      <AqAirqo :size="32" />
      Air Quality Dashboard
    </h1>
    <AqBarChart01 :size="48" class="text-blue-500" />
  </div>
</template>

<script setup>
import { AqAirqo, AqBarChart01 } from '@airqo/icons-vue';
</script>
```

### Vite + Vue 3

```javascript
// main.js
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);
app.mount('#app');
```

```vue
<!-- App.vue -->
<template>
  <div class="app">
    <header class="flex items-center gap-2">
      <AqHome01 />
      <h1>My App</h1>
    </header>
  </div>
</template>

<script setup>
import { AqHome01 } from '@airqo/icons-vue';
</script>
```

## Advanced Usage

### Global Registration

```javascript
// main.js
import { createApp } from 'vue';
import * as AirQoIcons from '@airqo/icons-vue';

const app = createApp(App);

// Register all icons globally (not recommended for production)
Object.entries(AirQoIcons).forEach(([name, component]) => {
  if (name.startsWith('Aq')) {
    app.component(name, component);
  }
});
```

### Dynamic Icons

```vue
<template>
  <component :is="iconComponent" :size="24" :color="iconColor" />
</template>

<script setup>
import { ref, computed } from 'vue';
import { AqHome01, AqSettings01, AqUser01 } from '@airqo/icons-vue';

const iconName = ref('home');
const iconColor = ref('#6366f1');

const iconComponent = computed(() => {
  const iconMap = {
    home: AqHome01,
    settings: AqSettings01,
    user: AqUser01,
  };
  return iconMap[iconName.value] || AqHome01;
});
</script>
```

### Composables

```javascript
// composables/useIcons.js
import { ref } from 'vue';

export function useIcons() {
  const iconSize = ref(24);
  const iconColor = ref('currentColor');

  const setIconTheme = (theme) => {
    iconColor.value = theme === 'dark' ? '#f8fafc' : '#1e293b';
  };

  return {
    iconSize,
    iconColor,
    setIconTheme,
  };
}
```

## Styling & Theming

### CSS Classes

```vue
<template>
  <!-- Tailwind CSS -->
  <AqHeart class="text-red-500 hover:text-red-600 transition-colors" />

  <!-- Custom CSS -->
  <AqStar class="star-icon" />
</template>

<style scoped>
.star-icon {
  color: #fbbf24;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  transition: all 0.2s ease;
}

.star-icon:hover {
  transform: scale(1.1);
  color: #f59e0b;
}
</style>
```

### CSS Variables

```css
:root {
  --icon-color-primary: #3b82f6;
  --icon-color-secondary: #6b7280;
  --icon-size-sm: 16px;
  --icon-size-md: 24px;
  --icon-size-lg: 32px;
}

.icon-primary {
  color: var(--icon-color-primary);
}
```

## Bundle Information

- **Total Bundle**: ~6.4MB (uncompressed), ~1.8MB (gzipped)
- **Tree-shakable**: Only imports what you use
- **Individual Icon**: ~4-6KB each
- **Zero Dependencies**: Pure Vue 3 components

## Browser Support

- **Vue 3.3+**: Full support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **SSR**: Next.js, Quasar, Vite SSR
- **Mobile**: iOS Safari, Chrome Mobile

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/airqo-platform/airqo-libraries/blob/main/CONTRIBUTING.md).

## License

MIT © [AirQo Organization](https://github.com/airqo-platform)
