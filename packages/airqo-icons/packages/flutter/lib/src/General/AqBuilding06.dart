import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBuilding06 icon widget (building-06.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBuilding06 extends StatelessWidget {
  /// Creates a AqBuilding06 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBuilding06({
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
<path d="M11 11H6.2C5.07989 11 4.51984 11 4.09202 11.218C3.71569 11.4097 3.40973 11.7157 3.21799 12.092C3 12.5198 3 13.0799 3 14.2V21M21 21V6.2C21 5.0799 21 4.51984 20.782 4.09202C20.5903 3.71569 20.2843 3.40973 19.908 3.21799C19.4802 3 18.9201 3 17.8 3H14.2C13.0799 3 12.5198 3 12.092 3.21799C11.7157 3.40973 11.4097 3.71569 11.218 4.09202C11 4.51984 11 5.0799 11 6.2V21M22 21H2M14.5 7H17.5M14.5 11H17.5M14.5 15H17.5" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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