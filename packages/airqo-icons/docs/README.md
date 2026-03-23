# 📘 AirQO Icons – Complete Developer Guide

> Professional-grade icon library for ## 🛠️ Adding & Updating Icons

### 1. Add New SVG Icons

Drop SVG files into the appropriate category folder:

```bash
# Add to existing category
packages/core/src/icons/General/my-new-icon.svg

# Create new category (auto-generates namespace)
packages/core/src/icons/MyCategory/icon-one.svg
packages/core/src/icons/MyCategory/icon-two.svg
```

**SVG Requirements:**

- Valid XML syntax
- ViewBox attribute required
- No hardcoded dimensions
- Clean, optimized paths
- Single color (black) - customizable via props

### 2. Build & Generate Components

```bash
# Install dependencies
pnpm install

# Generate React & Flutter components
pnpm run build:all

# Watch mode for development
pnpm run dev
```

### 3. Create Release Changeset

```bash
# Interactive changeset creation
pnpm changeset
# ✓ Select packages to update
# ✓ Choose semantic version bump (major/minor/patch)
# ✓ Write release notes

# Commit changes
git add .
git commit -m "feat: add new icon categories"
git push origin main
```

**GitHub Actions automatically publishes to NPM when changesets are merged!**r with 1,376 icons across 21 categories

[![Interactive Browser](https://img.shields.io/badge/🌐_Browse_Icons-4F46E5?style=flat-square)](https://airqo-icons.vercel.app)
[![Contributors](https://img.shields.io/github/contributors/airqo-platform/airqo-libraries?style=flat-square)](https://github.com/airqo-platform/airqo-libraries/graphs/contributors)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📦 Package Overview

| Package               | Purpose                      | Registry                                                                                                 | Bundle Size                                                                                     | Framework    |
| --------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ |
| `@airqo/icons-core`   | Source SVG files _(private)_ | —                                                                                                        | —                                                                                               | Core         |
| `@airqo/icons-react`  | React/Next.js components     | [![npm](https://img.shields.io/npm/v/@airqo/icons-react)](https://npmjs.com/@airqo/icons-react)          | ![Bundle Size](https://img.shields.io/bundlephobia/minzip/@airqo/icons-react?style=flat-square) | React 18+    |
| `airqo_icons_flutter` | Flutter widgets              | [![pub](https://img.shields.io/pub/v/airqo_icons_flutter)](https://pub.dev/packages/airqo_icons_flutter) | ~2MB                                                                                            | Flutter 3.0+ |

### ✨ Key Features

- 🎯 **1,376 production-ready icons** across 21 comprehensive categories
- 🌍 **196 country flags** with consistent styling and complete A-Z coverage
- ⚡ **Tree-shakable** – only bundle the icons you use
- 🎨 **Fully customizable** – size, color, stroke width, animations
- 📱 **Multi-platform** – React, Flutter, with Vue & Svelte coming soon
- ♿ **Accessibility first** – semantic labels and screen reader support
- 🔥 **TypeScript native** – full type safety out of the box

## 🏗️ Project Structure

```
airqo-icons/
├── packages/
│   ├── core/                    # 🎯 Source SVG files (1,376 icons)
│   │   └── src/icons/          # Organized by category
│   │       ├── Flags/          # 196 country flags A-Z
│   │       ├── General/        # 197 essential UI icons
│   │       ├── Charts/         # 49 data visualization icons
│   │       └── Communication/  # 58 messaging & contact icons
│   ├── react/                  # ⚛️ React components
│   │   ├── src/components/     # Generated TypeScript components
│   │   ├── tsup.config.ts      # Bundle configuration
│   │   └── package.json        # NPM package metadata
│   └── flutter/                # 📱 Flutter widgets
│       ├── lib/                # Generated Dart widgets
│       ├── pubspec.yaml        # Package configuration
│       └── README.md           # Flutter-specific docs
├── tools/
│   ├── generators/             # 🔧 Code generation scripts
│   │   ├── react-generator.js  # SVG → React component
│   │   └── flutter-generator.js # SVG → Flutter widget
│   ├── package-manager/        # Package management utilities
│   └── release/                # Automated release tools
├── docs/                       # 📚 Comprehensive documentation
├── .changeset/                 # 📝 Release management
├── .github/workflows/          # 🚀 CI/CD automation
└── *.md                        # Project documentation
```

## 🔍 Icon Categories & Counts

| Category             | Count | Description            | Examples                                                   |
| -------------------- | ----- | ---------------------- | ---------------------------------------------------------- |
| 🏳️ **Flags**         | 196   | Country flags A-Z      | `FlagsUganda`, `FlagsUSA`, `FlagsJapan`                    |
| 🏠 **General**       | 197   | Essential UI elements  | `GeneralHome`, `GeneralSettings`, `GeneralSearch`          |
| 📊 **Charts**        | 49    | Data visualization     | `ChartsBarChart`, `ChartsPieChart`, `ChartsLineGraph`      |
| 💬 **Communication** | 58    | Messaging & contact    | `CommunicationEmail`, `CommunicationPhone`                 |
| 💻 **Development**   | 57    | Developer tools        | `DevelopmentCode`, `DevelopmentGit`, `DevelopmentTerminal` |
| ✏️ **Editor**        | 104   | Text editing           | `EditorBold`, `EditorItalic`, `EditorUnderline`            |
| 🎓 **Education**     | 31    | Learning & academia    | `EducationBook`, `EducationGraduate`                       |
| 📄 **Files**         | 58    | Document types         | `FilesPDF`, `FilesWord`, `FilesExcel`                      |
| 💰 **Finance**       | 79    | Financial & commerce   | `FinanceDollar`, `FinanceCard`, `FinanceBank`              |
| 🗺️ **Maps**          | 42    | Location & navigation  | `MapsLocation`, `MapsNavigation`, `MapsCompass`            |
| 🎵 **Media**         | 108   | Audio & video controls | `MediaPlay`, `MediaPause`, `MediaVolume`                   |
| 🔒 **Security**      | 36    | Privacy & protection   | `SecurityLock`, `SecurityShield`, `SecurityKey`            |
| 🔺 **Shapes**        | 25    | Geometric shapes       | `ShapesCircle`, `ShapesSquare`, `ShapesTriangle`           |
| ⏰ **Time**          | 28    | Temporal elements      | `TimeClock`, `TimeCalendar`, `TimeStopwatch`               |
| 👥 **Users**         | 41    | People & profiles      | `UsersProfile`, `UsersGroup`, `UsersAdmin`                 |
| 🌤️ **Weather**       | 52    | Climate & conditions   | `WeatherSun`, `WeatherRain`, `WeatherCloud`                |
| **...and more**      | 191   | Additional categories  | Navigation, Social, Transportation, etc.                   |

**Total: 1,376 icons** across 21 categories

---

## 2️⃣ Adding / updating icons

1.  **Add SVG**  
    Drop files into `packages/core/src/icons/<group>/<name>.svg`  
    (group folders become Pascal-case namespaces).

2.  **Build**

    ```bash
    pnpm install
    pnpm run build:all
    ```

3.  **Create changeset**
    ```bash
    pnpm changeset
    # choose package(s) & semver bump
    git add .
    git commit -m "feat: new icons"
    git push origin main
    ```
    GitHub Actions will publish to **npm** (and later to **pub.dev** when you tag `flutter-v*.*.*`).

---

## 3️⃣ React usage

### Install

```bash
npm install @airqo/icons-react
```

### Import

```tsx
import { General, Navigation } from "@airqo/icons-react";

export default function App() {
  return (
    <>
      <General.AirqoLogo size={48} color="#00BFA5" strokeWidth={1.5} />
      <Navigation.Menu size={24} />
    </>
  );
}
```

### Props (every icon)

| Prop                                                           | Type     | Default          |
| -------------------------------------------------------------- | -------- | ---------------- | ---- |
| `size`                                                         | `string  | number`          | `24` |
| `color`                                                        | `string` | `"currentColor"` |
| `strokeWidth`                                                  | `number` | `0`              |
| All standard `<svg>` attributes (`className`, `onClick`, etc.) |

### Tree-shaking

```ts
import { ArrowLeft } from "@airqo/icons-react/navigation";
```

Bundle size only includes the icons you import.

---

## 4️⃣ Flutter usage

### Install

```yaml
# pubspec.yaml
dependencies:
  airqo_icons_flutter: ^1.0.0
```

### Import

```dart
import 'package:airqo_icons_flutter/general.dart' as icons;

IconButton(
  icon: icons.AirqoLogo(size: 32, color: Colors.green, strokeWidth: 1.5),
  onPressed: () {},
);
```

---

## 5️⃣ Naming rules

- **Filenames** → valid JS identifiers (`arrow-left.svg`, `close.svg`)
- **Component names** → Pascal-case (`ArrowLeft`, `Close`)
- **Groups** → Pascal-case folders (`General`, `Navigation`)
- **Duplicates allowed** across groups – they are namespaced automatically.

---

## 6️⃣ Local development commands

| Command                   | Description                        |
| ------------------------- | ---------------------------------- |
| `pnpm install`            | Install all deps                   |
| `pnpm run build:all`      | Compile every package              |
| `pnpm run dev`            | Watch mode (core → react)          |
| `pnpm changeset`          | Prepare release notes              |
| `pnpm run release`        | Version, build, and publish to npm |
| `pnpm run release:canary` | Publish snapshot (tag: `canary`)   |

---

## 7️⃣ CI / publishing

| Registry    | Trigger                         |
| ----------- | ------------------------------- |
| **npm**     | Push to `main` with a changeset |
| **pub.dev** | Tag `flutter-v*.*.*`            |

Example release flow:

```bash
# 1. Add icons
cp new-icon.svg packages/core/src/icons/general/
pnpm run build:all

# 2. Create & push changeset
pnpm changeset
git add . && git commit -m "feat: new icons"
git push origin main   # → npm auto-published

# 3. Flutter release (when ready)
git tag flutter-v1.0.1
git push origin flutter-v1.0.1   # → pub.dev auto-published
```

---

## 8️⃣ Troubleshooting

| Problem                            | Fix                                                               |
| ---------------------------------- | ----------------------------------------------------------------- |
| Build fails with `ref` type errors | Ensure you’re using the generator from the latest commit          |
| Icon not found                     | Verify filename is valid JS identifier & run `pnpm run build:all` |
| Duplicate component name           | Use group namespaces or rename SVG file                           |

---

## 9️⃣ Next steps

- Create your **NPM account** and add the secret `NPM_TOKEN` in GitHub → Settings → Secrets.
- Add **PUB_TOKEN** when you’re ready for Flutter releases.
- Ready to test?
  ```bash
  npx create-next-app@latest my-app
  cd my-app && npm install @airqo/icons-react
  ```

Happy building with AirQo Icons!
