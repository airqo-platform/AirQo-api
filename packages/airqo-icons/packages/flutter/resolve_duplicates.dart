import 'dart:io';

void main() async {
  const packageRoot = 'lib/src';

  // Map category folder to prefix
  final categoryPrefixes = <String, String>{
    'Editor': 'Ed',
    'Images': 'Img',
    'Education': 'Edu',
    'Maps_Travel': 'Map',
    'Alerts_Feedback': 'Alert',
    'Communication': 'Comm',
  };

  // Find and resolve duplicates
  final duplicates = <String, List<String>>{
    'AqColors': ['Editor', 'Images'],
    'AqGlobe01': ['Education', 'Maps_Travel'],
    'AqGlobe02': ['Education', 'Maps_Travel'],
    'AqMessageNotificationSquare': ['Alerts_Feedback', 'Communication'],
  };

  for (final entry in duplicates.entries) {
    final iconName = entry.key;
    final categories = entry.value;

    print('Processing duplicate: $iconName in categories: $categories');

    for (int i = 1; i < categories.length; i++) {
      final category = categories[i];
      final prefix = categoryPrefixes[category] ?? category.substring(0, 3);
      final newName =
          'Aq${prefix}${iconName.substring(2)}'; // Remove 'Aq' and add new prefix

      print('  Renaming $category/$iconName.dart to $category/$newName.dart');

      // Read the original file
      final originalFile = File('$packageRoot/$category/$iconName.dart');
      if (await originalFile.exists()) {
        String content = await originalFile.readAsString();

        // Replace class name and comments
        content = content.replaceAll('class $iconName', 'class $newName');
        content = content.replaceAll(
            '/// $iconName icon widget', '/// $newName icon widget');
        content = content.replaceAll('/// Creates a $iconName icon widget',
            '/// Creates a $newName icon widget');

        // Write to new file
        final newFile = File('$packageRoot/$category/$newName.dart');
        await newFile.writeAsString(content);

        // Delete original file
        await originalFile.delete();

        // Update the category export file
        await updateCategoryExport(category, iconName, newName);

        print('  ✅ Renamed $iconName to $newName in $category');
      }
    }
  }
}

Future<void> updateCategoryExport(
    String category, String oldName, String newName) async {
  final exportFile = File('lib/src/$category/$category.dart');
  if (await exportFile.exists()) {
    String content = await exportFile.readAsString();
    content = content.replaceAll(
        "export '$oldName.dart';", "export '$newName.dart';");
    await exportFile.writeAsString(content);
  }
}
