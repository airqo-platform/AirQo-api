import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import '../lib/src/airqo_icons.dart';

void main() {
  group('AirQO Icons Flutter Tests', () {
    testWidgets('AqActivity icon renders correctly',
        (WidgetTester tester) async {
      // Test basic icon rendering with Aq prefix
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AqActivity(),
          ),
        ),
      );

      // Verify the icon widget is present
      expect(find.byType(AqActivity), findsOneWidget);
    });

    testWidgets('AqActivity renders with custom size and color',
        (WidgetTester tester) async {
      const double customSize = 32.0;
      const Color customColor = Colors.red;

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AqActivity(
              size: customSize,
              color: customColor,
            ),
          ),
        ),
      );

      final iconWidget = tester.widget<AqActivity>(find.byType(AqActivity));
      expect(iconWidget.size, customSize);
      expect(iconWidget.color, customColor);
    });

    testWidgets('Icons have proper default values',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AqActivity(),
          ),
        ),
      );

      final iconWidget = tester.widget<AqActivity>(find.byType(AqActivity));
      expect(iconWidget.size, 24.0); // Default size
      expect(iconWidget.color, isNull); // Default color is null
      expect(iconWidget.semanticsLabel, isNull); // Default semantics is null
    });

    testWidgets('Icon accepts semantics label', (WidgetTester tester) async {
      const String testLabel = 'Activity Icon';

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AqActivity(
              semanticsLabel: testLabel,
            ),
          ),
        ),
      );

      final iconWidget = tester.widget<AqActivity>(find.byType(AqActivity));
      expect(iconWidget.semanticsLabel, testLabel);
    });

    testWidgets('Multiple icons can be rendered together',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                AqActivity(),
                AqBookmark(),
              ],
            ),
          ),
        ),
      );

      expect(find.byType(AqActivity), findsOneWidget);
      expect(find.byType(AqBookmark), findsOneWidget);
    });

    testWidgets('Icon widget is a StatelessWidget',
        (WidgetTester tester) async {
      const iconWithParams = AqActivity(
        size: 32.0,
        color: Colors.blue,
        semanticsLabel: 'Test Icon',
      );

      expect(iconWithParams, isA<StatelessWidget>());
    });

    testWidgets('Icons maintain aspect ratio', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AqActivity(size: 48.0),
        ),
      );

      // Find SizedBox widgets that are direct children of the icon
      final sizedBoxes = tester.widgetList<SizedBox>(find.byType(SizedBox));
      final iconSizedBox = sizedBoxes.firstWhere(
        (box) => box.width == 48.0 && box.height == 48.0,
        orElse: () => sizedBoxes.first,
      );

      expect(iconSizedBox.width, iconSizedBox.height); // Should be square
    });

    testWidgets('Version information is accessible',
        (WidgetTester tester) async {
      expect(AirQOIconsVersion.totalIcons, 1383);
      expect(AirQOIconsVersion.totalGroups, 22);
      expect(AirQOIconsVersion.groups, isNotEmpty);
    });
  });
}
