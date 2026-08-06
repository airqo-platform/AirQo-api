import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRefreshCcw03 icon widget (refresh-ccw-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRefreshCcw03 extends StatelessWidget {
  /// Creates a AqRefreshCcw03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRefreshCcw03({
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
<path d="M14 2C14 2 14.8492 2.12132 18.364 5.63604C21.8787 9.15076 21.8787 14.8492 18.364 18.364C17.1187 19.6092 15.5993 20.4133 14 20.7762M14 2L20 2M14 2L14 8M10 21.9998C10 21.9998 9.15076 21.8785 5.63604 18.3638C2.12132 14.849 2.12132 9.15056 5.63604 5.63584C6.88131 4.39057 8.40072 3.5865 10 3.22363M10 21.9998L4 22M10 21.9998L10 16" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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