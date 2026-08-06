import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLightbulb01 icon widget (lightbulb-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLightbulb01 extends StatelessWidget {
  /// Creates a AqLightbulb01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLightbulb01({
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
<path d="M15 16.5V19C15 19.9319 15 20.3978 14.8478 20.7654C14.6448 21.2554 14.2554 21.6448 13.7654 21.8478C13.3978 22 12.9319 22 12 22C11.0681 22 10.6022 22 10.2346 21.8478C9.74458 21.6448 9.35523 21.2554 9.15224 20.7654C9 20.3978 9 19.9319 9 19V16.5M15 16.5C17.6489 15.3427 19.5 12.5755 19.5 9.5C19.5 5.35786 16.1421 2 12 2C7.85786 2 4.5 5.35786 4.5 9.5C4.5 12.5755 6.35114 15.3427 9 16.5M15 16.5H9" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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