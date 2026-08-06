import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBuilding01 icon widget (building-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBuilding01 extends StatelessWidget {
  /// Creates a AqBuilding01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBuilding01({
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
<path d="M15 21V15.6C15 15.0399 15 14.7599 14.891 14.546C14.7951 14.3578 14.6422 14.2049 14.454 14.109C14.2401 14 13.9601 14 13.4 14H10.6C10.0399 14 9.75992 14 9.54601 14.109C9.35785 14.2049 9.20487 14.3578 9.10899 14.546C9 14.7599 9 15.0399 9 15.6V21M19 21V6.2C19 5.0799 19 4.51984 18.782 4.09202C18.5903 3.71569 18.2843 3.40973 17.908 3.21799C17.4802 3 16.9201 3 15.8 3H8.2C7.07989 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V21M21 21H3M9.5 8H9.51M14.5 8H14.51M10 8C10 8.27614 9.77614 8.5 9.5 8.5C9.22386 8.5 9 8.27614 9 8C9 7.72386 9.22386 7.5 9.5 7.5C9.77614 7.5 10 7.72386 10 8ZM15 8C15 8.27614 14.7761 8.5 14.5 8.5C14.2239 8.5 14 8.27614 14 8C14 7.72386 14.2239 7.5 14.5 7.5C14.7761 7.5 15 7.72386 15 8Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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