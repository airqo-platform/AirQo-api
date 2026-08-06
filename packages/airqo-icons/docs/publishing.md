Below is the safest release sequence for this repository. The prepared versions are:

- `@airqo/icons-react@0.2.10`
- `@airqo/icons-vue@0.2.6`
- `airqo_icons_flutter@1.0.5`

Do not reuse a version that already exists; published versions are immutable.

## 1. Prepare the repository

Open PowerShell:

```powershell
$repoRoot = 'D:\projects\AirQo project\AirQo-api'
Set-Location "$repoRoot\packages\airqo-icons"

git status --short
git diff --check
```

Run the validation commands:

```powershell
npm.cmd run build --prefix .\packages\react
npm.cmd test --prefix .\packages\react -- --runInBand

npm.cmd run build --prefix .\packages\vue
npm.cmd test --prefix .\packages\vue -- --run

npm.cmd test --prefix .\packages\core -- --runInBand

node tools\release\verify-flutter-package.js --structure-only
```

Commit and push the release changes before publishing:

```powershell
git add packages/airqo-icons
git commit -m "fix: prepare production icon package releases"
git push
```

## 2. Authenticate with npm

Ensure your npm registry is correct:

```powershell
npm.cmd config set registry https://registry.npmjs.org/
npm.cmd login --auth-type=web --registry=https://registry.npmjs.org/
npm.cmd whoami --registry=https://registry.npmjs.org/
```

The npm account must have write access to the `@airqo` scope. Publishing requires 2FA or an appropriately configured granular token. npm recommends 2FA or trusted publishing for secure releases. [npm authentication guidance](https://docs.npmjs.com/about-two-factor-authentication/)

Do not commit `.npmrc` or expose an npm token. Rotate any token that may have been exposed.

## 3. Publish React

```powershell
Set-Location "$repoRoot\packages\airqo-icons\packages\react"

npm.cmd pkg get name version
npm.cmd view @airqo/icons-react@0.2.10 version
```

If the final command shows `0.2.10`, stop because that version is already published.

Inspect the package contents:

```powershell
npm.cmd pack --dry-run
```

Confirm that `dist/` and `README.md` are included and secrets, tests, and source-only files are excluded.

Publish:

```powershell
npm.cmd publish --access public
```

Complete the npm 2FA prompt if requested. Scoped packages require `--access public` when publishing publicly. [npm scoped package publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

Verify:

```powershell
npm.cmd view @airqo/icons-react@0.2.10 version dist.tarball --json
```

## 4. Test the published React package

Use a clean temporary project:

```powershell
$reactSmoke = Join-Path $env:TEMP 'airqo-icons-react-smoke'
New-Item -ItemType Directory -Force $reactSmoke | Out-Null
Set-Location $reactSmoke

npm.cmd init -y
npm.cmd install @airqo/icons-react@0.2.10 react@18 react-dom@18
```

Run the rendering check:

```powershell
node --input-type=module -e "import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {AqAirQlouds,AqSites} from '@airqo/icons-react'; const html=renderToStaticMarkup(React.createElement('main',null,React.createElement(AqAirQlouds,{color:'#ff0000'}),React.createElement(AqSites,{color:'#00aa00'}))); if(!html.includes('#ff0000')||!html.includes('#00aa00')) throw new Error(html); console.log('Published React package verified');"
```

## 5. Publish Vue

```powershell
Set-Location "$repoRoot\packages\airqo-icons\packages\vue"

npm.cmd pkg get name version
npm.cmd view @airqo/icons-vue@0.2.6 version
npm.cmd pack --dry-run
```

If `0.2.6` is not already published:

```powershell
npm.cmd publish --access public
```

Verify:

```powershell
npm.cmd view @airqo/icons-vue@0.2.6 version dist.tarball --json
```

## 6. Test the published Vue package

```powershell
$vueSmoke = Join-Path $env:TEMP 'airqo-icons-vue-smoke'
New-Item -ItemType Directory -Force $vueSmoke | Out-Null
Set-Location $vueSmoke

npm.cmd init -y
npm.cmd install @airqo/icons-vue@0.2.6 vue @vue/server-renderer
```

Run the SSR verification:

```powershell
node --input-type=module -e "import {createSSRApp,h} from 'vue'; import {renderToString} from '@vue/server-renderer'; import {AqAirQlouds,AqSites} from '@airqo/icons-vue'; const app=createSSRApp({render:()=>h('main',[h(AqAirQlouds,{color:'#ff0000'}),h(AqSites,{color:'#00aa00'})])}); const html=await renderToString(app); if(html.includes('#1C1D20')||!html.includes('#ff0000')||!html.includes('#00aa00')) throw new Error(html); console.log('Published Vue package verified');"
```

## 7. Prepare the Flutter package

```powershell
Set-Location "$repoRoot\packages\airqo-icons\packages\flutter"

flutter --version
flutter pub get
flutter analyze
flutter test
dart pub publish --dry-run
```

The dry-run must show:

- `pubspec.yaml`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `lib/airqo_icons_flutter.dart`
- `lib/src/...`

It must not include `.dart_tool`, build output, credentials, or unnecessary temporary files. Dart specifically recommends using `--dry-run` before publishing. [Dart publishing documentation](https://dart.dev/tools/pub/cmd/pub-lish)

## 8. Publish Flutter

Run:

```powershell
dart pub publish
```

A browser authentication flow will open. Use the Google account that is an uploader for the package or an administrator of the verified publisher. Pub.dev requires uploader permission to publish new versions. [Pub.dev publishing permissions](https://dart.dev/tools/pub/publishing)

Review the displayed package contents carefully, then confirm the upload.

Do not use `--force` for the first release attempt. It skips the confirmation prompt.

## 9. Test the published Flutter package

Create a clean Flutter app:

```powershell
$flutterSmoke = Join-Path $env:TEMP 'airqo-icons-flutter-smoke'
New-Item -ItemType Directory -Force $flutterSmoke | Out-Null
Set-Location $flutterSmoke

flutter create --empty .
flutter pub add airqo_icons_flutter
```

Confirm that the resolved version is `1.0.5`:

```powershell
flutter pub deps | Select-String airqo_icons_flutter
```

In `lib/main.dart`, use:

```dart
import 'package:flutter/material.dart';
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

void main() {
  runApp(
    const MaterialApp(
      home: Scaffold(
        body: Center(
          child: AqAirQlouds(
            size: 48,
            color: Colors.blue,
            semanticsLabel: 'AirQlouds',
          ),
        ),
      ),
    ),
  );
}
```

Validate the clean consumer:

```powershell
flutter analyze
flutter test
flutter build web --release
```

Finally, check the package page and confirm the new version, README, API documentation, and publisher badge appear correctly. New pub.dev versions can take a few minutes to become visible. [Pub.dev package layout guidance](https://dart.dev/tools/pub/package-layout)

If npm returns `E403`, `E401`, or pub.dev returns `403 Not an uploader`, stop and send me the exact error output without including credentials.
