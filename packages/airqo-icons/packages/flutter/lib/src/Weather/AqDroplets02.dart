import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDroplets02 icon widget (droplets-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDroplets02 extends StatelessWidget {
  /// Creates a AqDroplets02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDroplets02({
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
<path d="M12 21.5C13.8565 21.5 15.637 20.7625 16.9497 19.4497C18.2625 18.137 19 16.3565 19 14.5C19 12.5 18 10.6 16 9C14 7.4 12.5 5 12 2.5C11.5 5 10 7.4 8 9C6 10.6 5 12.5 5 14.5C5 16.3565 5.7375 18.137 7.05025 19.4497C8.36301 20.7625 10.1435 21.5 12 21.5Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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