# AirQo Icons maintainer guide

This repository uses the SVGs in `packages/core/src/icons` as the single source of truth. React, Vue, and Flutter components are generated from those assets.

## Repository layout

```text
packages/core/src/icons/     Source SVG assets
packages/react/              React package and build
packages/vue/                Vue 3 package and build
packages/flutter/            Flutter package and committed lib/
tools/generators/            Framework generators
tools/release/               Release validation scripts
```

## Add or update an icon

1. Put the SVG in the appropriate core category.
2. Use one `<svg>` root element with a valid `viewBox`.
3. Prefer a single monochrome paint for icons intended to support theming.
4. Regenerate all framework outputs.
5. Run the core SVG validation and framework tests.

```bash
node tools/generators/react-generator-enhanced.js
node tools/generators/vue-generator.js
node tools/generators/flutter-generator.js
npm test --prefix packages/core -- --runInBand
npm test --prefix packages/react -- --runInBand
```

## Release validation

React and Vue package validation:

```bash
npm run build --prefix packages/react
npm run build --prefix packages/vue
npm test --prefix packages/react -- --runInBand
npm test --prefix packages/vue -- --run
npm pack packages/react --pack-destination .tmp
npm pack packages/vue --pack-destination .tmp
```

Flutter validation:

```bash
node tools/release/verify-flutter-package.js
cd packages/flutter
flutter analyze
flutter test
dart pub publish --dry-run
```

Do not publish until the dry run shows the expected `lib/` files. The generated Flutter `lib/` directory is release content; React/Vue generated source and `dist/` are rebuilt by their npm `prepack` hooks.

## Consumer smoke tests

Test each published package from a clean consumer project:

```bash
npm i @airqo/icons-react
npm i @airqo/icons-vue
flutter pub add airqo_icons_flutter
```

Import the public names `AqAirQlouds` and `AqSites`, render them, and verify custom colors. The smoke test must use the registry version, not a workspace path, when validating a published release.

## Versioning

- React and Vue use npm SemVer patch/minor/major releases.
- Flutter uses pub.dev SemVer and requires a new version for every fix after publication.
- Update the package changelog with every release.
- Commit generated Flutter `lib/` output before tagging or publishing.

## Credentials

Keep `.npmrc` local and ignored. Use an environment variable such as `NPM_TOKEN` in `.npmrc.example`; never commit a real token. Rotate any token that has been exposed.
