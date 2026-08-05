import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBarChart12 icon widget (bar-chart-12.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBarChart12 extends StatelessWidget {
  /// Creates a AqBarChart12 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBarChart12({
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
<path d="M9 12H4.6C4.03995 12 3.75992 12 3.54601 12.109C3.35785 12.2049 3.20487 12.3578 3.10899 12.546C3 12.7599 3 13.0399 3 13.6V19.4C3 19.9601 3 20.2401 3.10899 20.454C3.20487 20.6422 3.35785 20.7951 3.54601 20.891C3.75992 21 4.03995 21 4.6 21H9M9 21H15M9 21L9 8.6C9 8.03995 9 7.75992 9.10899 7.54601C9.20487 7.35785 9.35785 7.20487 9.54601 7.10899C9.75992 7 10.0399 7 10.6 7H13.4C13.9601 7 14.2401 7 14.454 7.10899C14.6422 7.20487 14.7951 7.35785 14.891 7.54601C15 7.75992 15 8.03995 15 8.6V21M15 21H19.4C19.9601 21 20.2401 21 20.454 20.891C20.6422 20.7951 20.7951 20.6422 20.891 20.454C21 20.2401 21 19.9601 21 19.4V4.6C21 4.03995 21 3.75992 20.891 3.54601C20.7951 3.35785 20.6422 3.20487 20.454 3.10899C20.2401 3 19.9601 3 19.4 3H16.6C16.0399 3 15.7599 3 15.546 3.10899C15.3578 3.20487 15.2049 3.35785 15.109 3.54601C15 3.75992 15 4.03995 15 4.6V8" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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