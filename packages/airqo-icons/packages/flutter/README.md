# airqo_icons_flutter

AirQo's generated Flutter icon library. The package ships 1,384 public icon widgets across 22 categories and renders the shared SVG artwork through `flutter_svg`.

## Install

The fixed release is `1.0.5`:

```bash
flutter pub add airqo_icons_flutter
```

Or add the dependency explicitly:

```yaml
dependencies:
  airqo_icons_flutter: ^1.0.5
```

## Use an icon

```dart
import 'package:flutter/material.dart';
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

class MonitoringIcons extends StatelessWidget {
  const MonitoringIcons({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AqAirQlouds(
          size: 24,
          color: Colors.blue,
          semanticsLabel: 'AirQlouds',
        ),
        AqSites(
          size: 24,
          color: Colors.green,
          semanticsLabel: 'Sites',
        ),
      ],
    );
  }
}
```

Every icon accepts the same API:

| Parameter | Type | Default | Purpose |
| --- | --- | --- | --- |
| `size` | `double` | `24.0` | Sets width and height. |
| `color` | `Color?` | `null` | Applies a color filter; `null` preserves the SVG artwork. |
| `semanticsLabel` | `String?` | `null` | Provides an accessibility label to `flutter_svg`. |

## Import organization

The package entrypoint is:

```dart
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';
```

It exports all generated categories and version metadata. Consumers should not import files from `lib/src` directly.

## Requirements

- Dart SDK `^3.3.0`.
- Flutter with support for `flutter_svg ^2.0.9`.
- Android, iOS, Linux, macOS, Windows, and web support through Flutter's SVG rendering.

## Local development

From the repository root:

```bash
node tools/generators/flutter-generator.js
cd packages/flutter
flutter pub get
flutter analyze
flutter test
dart pub publish --dry-run
```

Generated `lib/` code is part of the published package and must be committed. The package's `.dart_tool/`, `build/`, and library lockfile are disposable and excluded from Git.

## License

MIT © AirQo Organization
