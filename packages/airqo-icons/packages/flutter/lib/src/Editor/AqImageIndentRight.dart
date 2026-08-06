import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqImageIndentRight icon widget (image-indent-right.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqImageIndentRight extends StatelessWidget {
  /// Creates a AqImageIndentRight icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqImageIndentRight({
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
<path d="M21 4H3M21 20H3M9 9.25H3M9 14.75H3M14.6 16H19.4C19.9601 16 20.2401 16 20.454 15.891C20.6422 15.7951 20.7951 15.6422 20.891 15.454C21 15.2401 21 14.9601 21 14.4V9.6C21 9.03995 21 8.75992 20.891 8.54601C20.7951 8.35785 20.6422 8.20487 20.454 8.10899C20.2401 8 19.9601 8 19.4 8H14.6C14.0399 8 13.7599 8 13.546 8.10899C13.3578 8.20487 13.2049 8.35785 13.109 8.54601C13 8.75992 13 9.03995 13 9.6V14.4C13 14.9601 13 15.2401 13.109 15.454C13.2049 15.6422 13.3578 15.7951 13.546 15.891C13.7599 16 14.0399 16 14.6 16Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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