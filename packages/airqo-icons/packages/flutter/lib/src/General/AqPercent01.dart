import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPercent01 icon widget (percent-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPercent01 extends StatelessWidget {
  /// Creates a AqPercent01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPercent01({
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
<path d="M19 5L5 19M7.5 6.5C7.5 7.05228 7.05228 7.5 6.5 7.5C5.94772 7.5 5.5 7.05228 5.5 6.5C5.5 5.94772 5.94772 5.5 6.5 5.5C7.05228 5.5 7.5 5.94772 7.5 6.5ZM18.5 17.5C18.5 18.0523 18.0523 18.5 17.5 18.5C16.9477 18.5 16.5 18.0523 16.5 17.5C16.5 16.9477 16.9477 16.5 17.5 16.5C18.0523 16.5 18.5 16.9477 18.5 17.5Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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