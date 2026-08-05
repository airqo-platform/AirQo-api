import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqColors icon widget (colors.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqColors extends StatelessWidget {
  /// Creates a AqColors icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqColors({
    super.key,
    this.size = 24.0,
    this.color,
    this.semanticsLabel,
  });

  /// The size of the icon (width and height).
  final double size;

  /// The color to apply to the icon. If null, uses the default SVG colors.
  final Color? color;

  /// The semantic label for accessibility.
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: SvgPicture.string(
        '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 20.4722C13.0615 21.4223 14.4633 22 16 22C19.3137 22 22 19.3137 22 16C22 13.2331 20.1271 10.9036 17.5798 10.2102M6.42018 10.2102C3.87293 10.9036 2 13.2331 2 16C2 19.3137 4.68629 22 8 22C11.3137 22 14 19.3137 14 16C14 15.2195 13.851 14.4738 13.5798 13.7898M18 8C18 11.3137 15.3137 14 12 14C8.68629 14 6 11.3137 6 8C6 4.68629 8.68629 2 12 2C15.3137 2 18 4.68629 18 8Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''',
        colorFilter: color != null 
            ? ColorFilter.mode(color!, BlendMode.srcIn)
            : null,
        semanticsLabel: semanticsLabel,
        fit: BoxFit.contain,
      ),
    );
  }
}