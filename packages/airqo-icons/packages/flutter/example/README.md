# AirQO Icons Flutter Example

This example demonstrates the usage of the `airqo_icons_flutter` package with comprehensive examples across all icon categories.

## Features Demonstrated

- **Interactive Icon Controls**: Adjust size and color of icons in real-time
- **Category Showcase**: Examples from major icon categories including:
  - General UI icons
  - Navigation and arrows
  - Charts and data visualization
  - Communication icons
  - Weather and environment
  - Country flags

## Getting Started

To run this example:

1. Ensure you have Flutter installed
2. Navigate to the example directory
3. Get dependencies:
   ```bash
   flutter pub get
   ```
4. Run the app:
   ```bash
   flutter run
   ```

## Usage Examples

### Basic Icon Usage

```dart
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

// Simple icon with default size
AqHome01()

// Customized icon
AqBarChart01(
  size: 32,
  color: Colors.blue,
  semanticsLabel: 'Bar chart icon',
)
```

### Icon Categories

The package includes 1,383 icons across 22 categories:

- AeroGlyphs (7 icons)
- Airqo (5 icons)
- Alerts_Feedback (26 icons)
- Arrows (92 icons)
- Charts (49 icons)
- Communication (58 icons)
- Development (57 icons)
- Editor (104 icons)
- Education (31 icons)
- Files (58 icons)
- Finance_eCommerce (79 icons)
- Flags (196 icons)
- General (197 icons)
- Images (29 icons)
- Layout (63 icons)
- Maps_Travel (42 icons)
- Media_devices (108 icons)
- Security (36 icons)
- Shapes (25 icons)
- Time (28 icons)
- Users (41 icons)
- Weather (52 icons)

## Customization Options

All icons support these parameters:

- `size`: Controls the width and height (default: 24.0)
- `color`: Override the default icon color
- `semanticsLabel`: Accessibility label for screen readers
