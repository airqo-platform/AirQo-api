import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCoinsStacked04 icon widget (coins-stacked-04.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCoinsStacked04 extends StatelessWidget {
  /// Creates a AqCoinsStacked04 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCoinsStacked04({
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
<path d="M20 5C20 6.65685 16.4183 8 12 8C7.58172 8 4 6.65685 4 5M20 5C20 3.34315 16.4183 2 12 2C7.58172 2 4 3.34315 4 5M20 5V19C20 20.6569 16.4183 22 12 22C7.58172 22 4 20.6569 4 19V5M20 9.6666C20 11.3235 16.4183 12.6666 12 12.6666C7.58172 12.6666 4 11.3235 4 9.6666M20 14.33C20 15.9869 16.4183 17.33 12 17.33C7.58172 17.33 4 15.9869 4 14.33" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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