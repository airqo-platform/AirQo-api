# AirQO Icons

> A comprehensive, production-ready icon library with **1,383 high-quality SVG icons** across 22 categories, designed for React and Flutter applications with enhanced search capabilities.

[![NPM Version](https://img.shields.io/npm/v/@airqo/icons-react?style=flat-square&logo=npm)](https://www.npmjs.com/package/@airqo/icons-react)
[![Flutter Package](https://img.shields.io/pub/v/airqo_icons_flutter?style=flat-square&logo=flutter)](https://pub.dev/packages/airqo_icons_flutter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/airqo-platform/airqo-libraries?style=flat-square&logo=github)](https://github.com/airqo-platform/airqo-libraries)

## ✨ Features

- 🎯 **1,383 icons** across 22 comprehensive categories with Aq prefix naming
- ⚡ **Tree-shakable** - Only import what you use with optimized bundles
- 🎨 **Fully customizable** - Size, color, className support with TypeScript
- 📱 **Multi-platform** - React, Flutter (Vue, Svelte coming soon)
- 🔍 **Enhanced Search** - Fuse.js powered intelligent search with synonyms
- 🌍 **Global coverage** - 196 country flags organized A-Z
- 🎪 **Production ready** - Used in AirQO's air quality monitoring platform
- 🚀 **Performance optimized** - Sub-100ms search across all icons

## 📦 Icon Categories

| Category                 | Count | Description                                |
| ------------------------ | ----- | ------------------------------------------ |
| 🏳️ **Flags**             | 196   | Country and regional flags (A-Z organized) |
| 🏠 **General**           | 197   | Common UI and utility icons                |
| � **Media_devices**      | 108   | Audio, video, and media controls           |
| ✏️ **Editor**            | 104   | Text editing and formatting tools          |
| ➡️ **Arrows**            | 92    | Directional and navigation indicators      |
| 💰 **Finance_eCommerce** | 79    | Payment, shopping, and financial services  |
| 🏢 **Layout**            | 63    | Page structure and grid components         |
| 💬 **Communication**     | 58    | Messaging and social interaction           |
| 📁 **Files**             | 58    | Document and file management               |
| 💻 **Development**       | 57    | Coding and developer tools                 |
| 🌦️ **Weather**           | 52    | Climate and weather conditions             |
| 📊 **Charts**            | 49    | Data visualization and analytics           |
| 👥 **Users**             | 41    | Profile and user management                |
| 🗺️ **Maps_Travel**       | 42    | Geographic and travel icons                |
| 🔒 **Security**          | 36    | Privacy and authentication                 |
| 🎓 **Education**         | 31    | Learning and academic content              |
| 🖼️ **Images**            | 29    | Photography and media assets               |
| ⏰ **Time**              | 28    | Clocks and temporal indicators             |
| 🚨 **Alerts_Feedback**   | 26    | Notifications and user feedback            |
| ⭕ **Shapes**            | 25    | Geometric shapes and forms                 |
| 🌪️ **AeroGlyphs**        | 7     | Air quality indicator glyphs               |
| 🏢 **Airqo**             | 5     | AirQO brand and product icons              |
| 📄 **Files**             | 58    | Documents and file types                   |
| 💰 **Finance**           | 79    | Money and e-commerce                       |
| 🗺️ **Maps & Travel**     | 42    | Location and navigation                    |
| 🎵 **Media & Devices**   | 108   | Multimedia and hardware                    |
| 🔒 **Security**          | 36    | Privacy and protection                     |
| 🔺 **Shapes**            | 25    | Geometric and design                       |
| ⏰ **Time**              | 28    | Calendar and clock                         |
| 👥 **Users**             | 41    | People and profiles                        |
| 🌤️ **Weather**           | 52    | Climate and environmental                  |
| ⚠️ **Alerts & Feedback** | 26    | Notifications and status                   |
| ➡️ **Arrows**            | 92    | Directional and navigation                 |
| 🖼️ **Images**            | 29    | Pictures and visual media                  |
| 📐 **Layout**            | 63    | Structure and positioning                  |
| 🌟 **AirQO**             | 5     | Brand-specific icons                       |

## 🚀 Quick Start

### React

```bash
npm install @airqo/icons-react
# or
yarn add @airqo/icons-react
# or
pnpm add @airqo/icons-react
```

> **Note:**
> If you want to use the advanced search utilities (`AirQOIconsUtils.searchIcons`, `useIconSearch`), you must also install `fuse.js`:
>
> ```bash
> npm install fuse.js
> ```

```tsx
import { FlagsUganda, GeneralHome, ChartsBarChart } from '@airqo/icons-react';

function App() {
  return (
    <div className="flex items-center space-x-4">
      <FlagsUganda size={32} className="text-green-600" />
      <GeneralHome size={24} className="text-blue-600" />
      <ChartsBarChart size={28} className="text-purple-600" />
    </div>
  );
}
```

#### Using Search Utilities (Optional)

To enable advanced icon search features, install `fuse.js` and use the provided utilities:

```bash
npm install fuse.js
```

```tsx
import { AirQOIconsUtils, useIconSearch } from '@airqo/icons-react';
// Now you can use AirQOIconsUtils.searchIcons or useIconSearch
```

### Flutter

Add to your `pubspec.yaml`:

```yaml
dependencies:
  airqo_icons_flutter: ^1.0.0
```

```dart
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AirqoIcons.flagsUganda(size: 32, color: Colors.green),
        AirqoIcons.generalHome(size: 24, color: Colors.blue),
        AirqoIcons.chartsBarChart(size: 28, color: Colors.purple),
      ],
    );
  }
}
  }
}
```

## � Documentation & API

### React Props

All React icons accept these props:

```tsx
interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string; // Icon size (default: 24)
  className?: string; // CSS classes
  color?: string; // Icon color
  // ... all standard SVG props
}
```

### Flutter Parameters

All Flutter icons accept these parameters:

```dart
Widget AirqoIcons.iconName({
  Key? key,
  double? size,           // Icon size (default: 24.0)
  Color? color,           // Icon color
  String? semanticLabel,  // Accessibility label
})
```

## 🔍 Finding Icons

### Icon Browser

Visit our **[Interactive Icon Browser](https://airqo-icons.vercel.app)** to:

- Browse all 1,376 icons by category
- Search icons by name or keyword
- Copy code snippets for React and Flutter
- Preview icons in different sizes and colors

### Icon Naming Convention

Icons follow a consistent naming pattern:

- **Format**: `{Category}{IconName}`
- **Examples**:
  - `FlagsUganda` (Flags category)
  - `GeneralHome` (General category)
  - `ChartsBarChart` (Charts category)

## 🛠️ Advanced Usage

### Tree Shaking (React)

Only import the icons you need for optimal bundle size:

```tsx
// ✅ Good - Tree shakable
import { FlagsUganda, GeneralHome } from '@airqo/icons-react';

// ❌ Avoid - Imports entire library
import * as Icons from '@airqo/icons-react';
```

### Custom Styling (React)

```tsx
import { GeneralHome } from '@airqo/icons-react';

function StyledIcon() {
  return (
    <GeneralHome
      size={48}
      className="text-blue-500 hover:text-blue-700 transition-colors"
      style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))' }}
    />
  );
}
```

### Responsive Icons (Flutter)

```dart
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

class ResponsiveIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final iconSize = screenWidth > 600 ? 32.0 : 24.0;

    return AirqoIcons.generalHome(
      size: iconSize,
      color: Theme.of(context).primaryColor,
    );
  }
}
```

## 🏗️ Development

### Building from Source

```bash
git clone https://github.com/airqo-platform/airqo-libraries.git
cd airqo-libraries/src/airqo-icons

# Install dependencies
pnpm install

# Build all packages
pnpm run build:all

# Build React package only
pnpm run build:react

# Build Flutter package only
pnpm run build:flutter
```

### Adding New Icons

1. Place SVG files in `packages/core/src/icons/{category}/`
2. Run the build process to generate components
3. Test the new icons in your application

## 📋 Requirements

### React

- React 16.8+ (hooks support)
- Node.js 18+
- TypeScript 4.5+ (optional but recommended)

### Flutter

- Flutter 3.0+
- Dart 3.0+
- flutter_svg ^2.0.9

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🌟 Acknowledgments

- Icons designed for AirQO's air quality monitoring platform
- Built with ❤️ for the global environmental monitoring community
- Special thanks to all contributors and the open source community

---

<div align="center">
  <p>Made with ❤️ by the <a href="https://airqo.net">AirQO Platform</a> team</p>
  <p>
    <a href="https://airqo-icons.vercel.app">🌐 Icon Browser</a> •
    <a href="https://github.com/airqo-platform/airqo-libraries">📂 Repository</a> •
    <a href="https://github.com/airqo-platform/airqo-libraries/issues">🐛 Issues</a> •
    <a href="https://airqo.net">🌍 AirQO Platform</a>
  </p>
</div>
- **General**: General purpose UI icons

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build:all

# Build specific package
pnpm run build:react
pnpm run build:flutter

# Generate icons only
node tools/generators/react-generator.js
node tools/generators/flutter-generator.js
```

## 📋 Icon Properties

### React

- `size?: number | string` - Icon size (default: 24)
- `color?: string` - Icon color (default: 'currentColor')
- `className?: string` - Additional CSS classes

### Flutter

- `size: double` - Icon size (default: 24.0)
- `color: Color?` - Icon color (optional)
- `semanticsLabel: String?` - Accessibility label

## 🤝 Contributing

1. Add SVG files to `packages/core/src/icons/{group}/`
2. Run `pnpm run build:all` to generate components
3. Test the generated components
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
