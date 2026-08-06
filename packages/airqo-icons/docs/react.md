# React usage

Install the published package:

```bash
npm i @airqo/icons-react
```

Use named imports:

```tsx
import { AqAirQlouds, AqSites } from '@airqo/icons-react';

export function AirQualityIcons() {
  return (
    <>
      <AqAirQlouds size={24} color="var(--color-primary)" aria-label="AirQlouds" />
      <AqSites size={24} color="var(--color-success)" aria-label="Sites" />
    </>
  );
}
```

Icons support `size`, `color`, `className`, all standard SVG attributes, refs, and SSR. See [the React package README](../packages/react/README.md) for the complete API.
