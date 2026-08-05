# @airqo/icons-react

Production-ready React icon components generated from AirQo's shared SVG library.

[![npm version](https://img.shields.io/npm/v/@airqo/icons-react)](https://www.npmjs.com/package/@airqo/icons-react)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

## Install

```bash
npm i @airqo/icons-react
```

## Use an icon

```tsx
import { AqAirQlouds, AqSites } from '@airqo/icons-react';

export function MonitoringIcons() {
  return (
    <div>
      <AqAirQlouds size={24} color="#2563eb" aria-label="AirQlouds" />
      <AqSites size={24} color="#16a34a" aria-label="Sites" />
    </div>
  );
}
```

Every icon is a `forwardRef` SVG component and accepts the standard SVG props plus:

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `size` | `number \| string` | `24` | Sets width and height. |
| `color` | `string` | `currentColor` | Sets the icon paint for monochrome artwork. |
| `className` | `string` | — | Adds CSS classes. |

All other SVG attributes are forwarded, including `aria-label`, `role`, event handlers, and `data-*` attributes.

## Styling

```tsx
<AqSites className="text-emerald-600 hover:text-emerald-800" />
<AqAirQlouds size="1.5rem" color="var(--brand-primary)" />
```

Use named imports in application code. They make dependencies explicit and allow bundlers to remove unused icons.

## Search utilities

The package also exports the optional icon search utilities:

```tsx
import { AirQOIconsUtils, useIconSearch } from '@airqo/icons-react';

const charts = AirQOIconsUtils.searchIcons('chart', { maxResults: 10 });
```

`useIconSearch` is intended for interactive pickers; use direct named imports for normal UI rendering.

## Accessibility

Give informative icons an accessible label and hide purely decorative icons from assistive technology when appropriate:

```tsx
<AqSites aria-label="Monitoring sites" role="img" />
<AqAirQlouds aria-hidden="true" focusable="false" />
```

## Package contents

- 1,384 generated SVG components across 22 categories.
- CommonJS, ESM, and TypeScript declaration builds.
- React 16.8+ support through `forwardRef` and hooks-compatible components.
- SSR-compatible output with no browser-only initialization.

## Local development

```bash
npm run build
npm test -- --runInBand
```

The generated `src/components/` and `dist/` directories are rebuildable and intentionally excluded from Git. The npm `prepack` hook regenerates and bundles them before publishing.

## License

MIT © AirQo Organization
