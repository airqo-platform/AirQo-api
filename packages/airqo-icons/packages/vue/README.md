# @airqo/icons-vue

Production-ready Vue 3 icon components generated from AirQo's shared SVG library.

[![npm version](https://img.shields.io/npm/v/@airqo/icons-vue)](https://www.npmjs.com/package/@airqo/icons-vue)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue)](https://www.typescriptlang.org/)

## Install

```bash
npm i @airqo/icons-vue
```

## Use an icon

```vue
<script setup lang="ts">
import { AqAirQlouds, AqSites } from '@airqo/icons-vue';
</script>

<template>
  <AqAirQlouds :size="24" color="#2563eb" aria-label="AirQlouds" />
  <AqSites :size="24" color="#16a34a" aria-label="Sites" />
</template>
```

Every icon accepts:

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `size` | `number \| string` | `24` | Sets width and height. |
| `color` | `string` | `currentColor` | Sets the icon paint for monochrome artwork. |
| `class` | `string` | — | Adds CSS classes. |

Standard SVG attributes and event listeners are forwarded to the root `<svg>` element.

## Styling and accessibility

```vue
<AqSites class="text-emerald-600 hover:text-emerald-800" />
<AqAirQlouds size="1.5rem" color="var(--brand-primary)" />
<AqSites aria-label="Monitoring sites" role="img" />
```

Use `aria-hidden="true"` for decorative icons.

## Framework support

The package works with Vue 3, Vite, Nuxt, and server-side rendering. Import components directly in `<script setup>` to keep application dependencies explicit and allow bundlers to remove unused icons.

```ts
import { AqHome01, AqSites } from '@airqo/icons-vue';
```

## Package contents

- 1,384 generated SVG components across 22 categories.
- ESM, UMD, and TypeScript declaration builds.
- Vue 3.3+ peer dependency.
- SSR-safe components with no browser-only initialization.

## Local development

```bash
npm run build
npm test -- --run
npm run type-check
```

The generated `src/components/` and `dist/` directories are rebuildable and intentionally excluded from Git. The npm `prepack` hook regenerates and bundles them before publishing.

## License

MIT © AirQo Organization
