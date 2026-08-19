import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRefreshCw03 icon widget (refresh-cw-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRefreshCw03 extends StatelessWidget {
  /// Creates a AqRefreshCw03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRefreshCw03({
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
<path d="M14 22C14 22 14.8492 21.8787 18.364 18.364C21.8787 14.8492 21.8787 9.15076 18.364 5.63604C17.1187 4.39077 15.5993 3.58669 14 3.22383M14 22H20M14 22L14 16M10 2.00019C10 2.00019 9.15076 2.12152 5.63604 5.63624C2.12132 9.15095 2.12132 14.8494 5.63604 18.3642C6.88131 19.6094 8.40072 20.4135 10 20.7764M10 2.00019L4 2M10 2.00019L10 8" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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