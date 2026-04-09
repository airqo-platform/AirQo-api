import 'package:flutter/material.dart';
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

/// Main application entry point demonstrating AirQO Icons Flutter usage.
void main() {
  runApp(const MyApp());
}

/// The main application widget showcasing various AirQO icon features.
class MyApp extends StatelessWidget {
  /// Creates the main application widget.
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AirQO Icons Flutter Example',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'AirQO Icons Flutter Demo'),
    );
  }
}

/// Home page demonstrating various icon categories and features.
class MyHomePage extends StatefulWidget {
  /// Creates the home page widget.
  const MyHomePage({super.key, required this.title});

  /// The title displayed in the app bar.
  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  Color _selectedColor = Colors.blue;
  double _iconSize = 32.0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildControlsSection(),
            const SizedBox(height: 24),
            _buildIconCategoriesSection(),
          ],
        ),
      ),
    );
  }

  /// Builds the controls section for customizing icon appearance.
  Widget _buildControlsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Icon Controls',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            Text('Size: ${_iconSize.toInt()}px'),
            Slider(
              value: _iconSize,
              min: 16.0,
              max: 64.0,
              divisions: 12,
              onChanged: (value) => setState(() => _iconSize = value),
            ),
            const SizedBox(height: 16),
            Text('Color:', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                Colors.blue,
                Colors.red,
                Colors.green,
                Colors.purple,
                Colors.orange,
                Colors.teal,
                Colors.indigo,
                Colors.pink,
              ].map((color) => _buildColorOption(color)).toList(),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds a color selection option.
  Widget _buildColorOption(Color color) {
    return GestureDetector(
      onTap: () => setState(() => _selectedColor = color),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: _selectedColor == color
              ? Border.all(color: Colors.black, width: 2)
              : null,
        ),
      ),
    );
  }

  /// Builds the icon categories showcase section.
  Widget _buildIconCategoriesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Icon Categories',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        _buildCategoryCard('General Icons', [
          AqHelp(size: _iconSize, color: _selectedColor),
          AqHome01(size: _iconSize, color: _selectedColor),
          AqSettings01(size: _iconSize, color: _selectedColor),
          AqSearchLg(size: _iconSize, color: _selectedColor),
          AqHeart(size: _iconSize, color: _selectedColor),
        ]),
        _buildCategoryCard('Navigation & Arrows', [
          AqArrowUp(size: _iconSize, color: _selectedColor),
          AqArrowDown(size: _iconSize, color: _selectedColor),
          AqArrowLeft(size: _iconSize, color: _selectedColor),
          AqArrowRight(size: _iconSize, color: _selectedColor),
          AqChevronUp(size: _iconSize, color: _selectedColor),
        ]),
        _buildCategoryCard('Charts & Data', [
          AqBarChart01(size: _iconSize, color: _selectedColor),
          AqLineChartUp01(size: _iconSize, color: _selectedColor),
          AqPieChart01(size: _iconSize, color: _selectedColor),
          AqTrendUp01(size: _iconSize, color: _selectedColor),
          AqBarChartCircle01(size: _iconSize, color: _selectedColor),
        ]),
        _buildCategoryCard('Communication', [
          AqMail01(size: _iconSize, color: _selectedColor),
          AqMessageCircle01(size: _iconSize, color: _selectedColor),
          AqPhone(size: _iconSize, color: _selectedColor),
          AqInbox01(size: _iconSize, color: _selectedColor),
          AqSend01(size: _iconSize, color: _selectedColor),
        ]),
        _buildCategoryCard('Weather & Environment', [
          AqSun(size: _iconSize, color: _selectedColor),
          AqCloud01(size: _iconSize, color: _selectedColor),
          AqCloudRaining01(size: _iconSize, color: _selectedColor),
          AqWind01(size: _iconSize, color: _selectedColor),
          AqThermometer01(size: _iconSize, color: _selectedColor),
        ]),
        _buildCategoryCard('Country Flags', [
          AqUganda(size: _iconSize, color: _selectedColor),
          AqUnitedKingdom(size: _iconSize, color: _selectedColor),
          AqUnitedStatesOfAmerica(size: _iconSize, color: _selectedColor),
          AqUkraine(size: _iconSize, color: _selectedColor),
          AqUnitedArabEmirates(size: _iconSize, color: _selectedColor),
        ]),
      ],
    );
  }

  /// Builds a category card with icons.
  Widget _buildCategoryCard(String title, List<Widget> icons) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: icons,
            ),
          ],
        ),
      ),
    );
  }
}
