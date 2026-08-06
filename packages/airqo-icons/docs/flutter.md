# Flutter usage

Install the fixed package release:

```bash
flutter pub add airqo_icons_flutter
```

Import the public entrypoint:

```dart
import 'package:flutter/material.dart';
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

const AqAirQlouds(
  size: 24,
  color: Colors.blue,
  semanticsLabel: 'AirQlouds',
);
```

The package exposes `size`, `color`, and `semanticsLabel` on every icon. See [the Flutter package README](../packages/flutter/README.md) for requirements and release validation.
