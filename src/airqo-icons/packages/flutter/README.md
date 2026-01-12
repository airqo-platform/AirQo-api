# airqo_icons_flutter

> High-quality Flutter icon widgets with Aq prefix naming - 1,383 icons across 22 categories

[![Pub Version](https://img.shields.io/pub/v/airqo_icons_flutter?style=flat-square&logo=dart)](https://pub.dev/packages/airqo_icons_flutter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Flutter Support](https://img.shields.io/badge/Flutter-3.0%2B-02569B?style=flat-square&logo=flutter)](https://flutter.dev)

## 🚀 Installation

Add this to your package's `pubspec.yaml` file:

```yaml
dependencies:
  airqo_icons_flutter: ^1.0.0
```

Then run:

```bash
flutter pub get
```

## ✨ Features

- 🎯 **1,383 icons** across 22 comprehensive categories
- 🏷️ **Aq prefix naming** - Consistent naming convention (AqHome01, AqUser, etc.)
- 📱 **Flutter 3.0+ compatible** with latest framework features
- 🎨 **Fully customizable** - size, color, semantic labels
- 🌍 **Global coverage** - 196 country flags A-Z
- ⚡ **Performance optimized** - SVG-based with minimal overhead
- ♿ **Accessibility ready** - Built-in semantic label support
- 🎪 **Production tested** - Used in AirQO's monitoring platform

## 🎯 Quick Start

```dart
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AqUganda(size: 32, color: Colors.green),
        AqHome01(size: 24, color: Colors.blue),
        AqBarChart01(size: 28, color: Colors.purple),
      ],
    );
  }
}
```

## 📋 API Reference

### Icon Parameters

All icons accept these parameters:

```dart
Widget AqIconWidget({
  Key? key,                    // Widget key
  double size = 24.0,         // Icon size (default: 24.0)
  Color? color,               // Icon color (uses SVG default if null)
  String? semanticLabel,      // Accessibility label
})
```

### Usage Examples

```dart
// Basic usage with Aq prefix
AqHome01()

// With custom size
AqHome01(size: 32.0)

// With custom color
AqHome01(color: Colors.blue)

// With accessibility label
AqHome01(
  size: 24.0,
  color: Colors.blue,
  semanticLabel: 'Home icon',
)

// In buttons and interactive widgets
IconButton(
  onPressed: () => print('Home tapped'),
  icon: AqHome01(size: 24.0),
)

// In app bars
AppBar(
  leading: AqMenu01(color: Colors.white),
  title: Text('My App'),
)

// In lists and cards
ListTile(
  leading: AqUser(color: Colors.grey[600]),
  title: Text('User Profile'),
  trailing: AqArrowRight(),
)
```

## 🔍 Icon Categories

| Category             | Count | Examples                                                                  |
| -------------------- | ----- | ------------------------------------------------------------------------- |
| 🏳️ **Flags**         | 196   | `FlagsUganda`, `FlagsUSA`, `FlagsJapan`                                   |
| 🏠 **General**       | 197   | `GeneralHome01`, `GeneralSettings01`, `GeneralSearchLg`                   |
| 📊 **Charts**        | 49    | `ChartsBarChart01`, `ChartsPieChart01`, `ChartsLineChart01`               |
| 💬 **Communication** | 58    | `CommunicationMail01`, `CommunicationPhone01`, `CommunicationMessageChat` |
| 💻 **Development**   | 57    | `DevelopmentCode01`, `DevelopmentGithub`, `DevelopmentTerminal`           |
| ✏️ **Editor**        | 104   | `EditorBold`, `EditorItalic`, `EditorUnderline01`                         |
| 🎓 **Education**     | 31    | `EducationBook01`, `EducationGraduationHat01`, `EducationCertificate01`   |
| 📄 **Files**         | 58    | `FilesPdf`, `FilesDocx`, `FilesXls01`                                     |
| 💰 **Finance**       | 79    | `FinanceDollarCircle`, `FinanceCreditCard01`, `FinanceBank`               |
| 🗺️ **Maps**          | 42    | `MapsMarkerPin01`, `MapsNavigation01`, `MapsCompass01`                    |
| 🎵 **Media**         | 108   | `MediaPlay`, `MediaPause`, `MediaVolumeX`                                 |
| 🔒 **Security**      | 36    | `SecurityLock01`, `SecurityShield01`, `SecurityKey01`                     |
| 🔺 **Shapes**        | 25    | `ShapesCircle`, `ShapesSquare`, `ShapesTriangle`                          |
| ⏰ **Time**          | 28    | `TimeClock`, `TimeCalendar01`, `TimeStopwatch01`                          |
| 👥 **Users**         | 41    | `UsersUser01`, `UsersUserGroup`, `UsersUserCheck01`                       |
| 🌤️ **Weather**       | 52    | `WeatherSun`, `WeatherCloudRaining01`, `WeatherCloud01`                   |

## 🌐 Icon Browser

Visit our **[Interactive Icon Browser](https://airqo-icons.vercel.app)** to:

- Browse all icons by category
- Search by name or keyword
- Copy Flutter code snippets
- Preview different sizes and colors

## 🛠️ Advanced Usage

### Responsive Icons

```dart
class ResponsiveIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final iconSize = screenWidth > 600 ? 32.0 : 24.0;

    return GeneralHome01(
      size: iconSize,
      color: Theme.of(context).primaryColor,
    );
  }
}
```

### Theme-Aware Icons

```dart
class ThemedIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GeneralSettings01(
      size: 24.0,
      color: isDark ? Colors.white : Colors.black,
    );
  }
}
```

### Custom Icon Widget

```dart
class CustomIcon extends StatelessWidget {
  final Widget Function({double? size, Color? color, String? semanticLabel}) iconBuilder;
  final String label;
  final VoidCallback? onTap;

  const CustomIcon({
    Key? key,
    required this.iconBuilder,
    required this.label,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          iconBuilder(
            size: 32.0,
            color: Theme.of(context).primaryColor,
            semanticLabel: label,
          ),
          SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.caption,
          ),
        ],
      ),
    );
  }
}

// Usage
CustomIcon(
  iconBuilder: ({size, color, semanticLabel}) => GeneralHome01(
    size: size ?? 24.0,
    color: color,
    semanticLabel: semanticLabel,
  ),
  label: 'Home',
  onTap: () => Navigator.pushNamed(context, '/home'),
)
```

### Icon Grid

```dart
class IconGrid extends StatelessWidget {
  final List<MapEntry<String, Widget Function({double? size, Color? color})>> icons = [
    MapEntry('Home', ({size, color}) => GeneralHome01(size: size ?? 24.0, color: color)),
    MapEntry('Settings', ({size, color}) => GeneralSettings01(size: size ?? 24.0, color: color)),
    MapEntry('Profile', ({size, color}) => UsersUser01(size: size ?? 24.0, color: color)),
    MapEntry('Charts', ({size, color}) => ChartsBarChart01(size: size ?? 24.0, color: color)),
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: icons.length,
      itemBuilder: (context, index) {
        final icon = icons[index];
        return Card(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              icon.value(size: 48.0),
              SizedBox(height: 8),
              Text(icon.key),
            ],
          ),
        );
      },
    );
  }
}
```

## 🎨 Styling Examples

### Material Design Integration

```dart
// In App Bar
AppBar(
  leading: GeneralMenu01(color: Colors.white),
  title: Text('AirQO Dashboard'),
  actions: [
    IconButton(
      icon: GeneralNotificationSquare(color: Colors.white),
      onPressed: () => _showNotifications(),
    ),
  ],
)

// In Bottom Navigation
BottomNavigationBar(
  items: [
    BottomNavigationBarItem(
      icon: GeneralHome01(),
      label: 'Home',
    ),
    BottomNavigationBarItem(
      icon: ChartsBarChart01(),
      label: 'Analytics',
    ),
    BottomNavigationBarItem(
      icon: UsersUser01(),
      label: 'Profile',
    ),
  ],
)

// In Floating Action Button
FloatingActionButton(
  onPressed: _addNewItem,
  child: GeneralPlus(color: Colors.white),
)
```

### Custom Animations

```dart
class AnimatedIcon extends StatefulWidget {
  @override
  _AnimatedIconState createState() => _AnimatedIconState();
}

class _AnimatedIconState extends State<AnimatedIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(seconds: 2),
      vsync: this,
    )..repeat();
    _animation = Tween<double>(begin: 0, end: 1).animate(_controller);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Transform.rotate(
          angle: _animation.value * 2 * 3.14159,
          child: GeneralSettings01(
            size: 32.0,
            color: Colors.blue,
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
```

## ♿ Accessibility

The package includes built-in accessibility support:

```dart
// Provide semantic labels for screen readers
GeneralHome01(
  semanticLabel: 'Navigate to home screen',
)

// Use in semantic widgets.
Semantics(
  button: true,
  hint: 'Tap to open settings',
  child: GestureDetector(
    onTap: _openSettings,
    child: GeneralSettings01(),
  ),
)
```

## 🔧 Requirements

- **Flutter**: 3.0 or higher
- **Dart**: 3.0 or higher
- **Dependencies**:
  - `flutter_svg: ^2.0.9`
  - `meta: ^1.9.1`

## 📦 Package Size

The package is optimized for minimal impact:

- **Package size**: ~2MB
- **Runtime overhead**: Minimal (SVG-based)
- **Memory usage**: Icons are loaded on-demand

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/airqo-platform/airqo-libraries/blob/main/CONTRIBUTING.md).

## 📄 License

MIT © [AirQ0 Platform](https://analytics.airqo.net/account/login)

## 🔗 Links

- [📖 Main Documentation](https://github.com/airqo-platform/airqo-libraries/tree/main/src/airqo-icons)
- [🌐 Icon Browser](https://aero-glyphs.vercel.app/)
- [📱 React Package](https://www.npmjs.com/package/@airqo/icons-react)
- [🐛 Report Issues](https://github.com/airqo-platform/airqo-libraries/issues)
- [🌍 AirQo Platform](https://analytics.airqo.net/account/login)
