import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqHurricane01 icon widget (hurricane-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqHurricane01 extends StatelessWidget {
  /// Creates a AqHurricane01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqHurricane01({
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
<path d="M16.5 20.5002C15.2465 20.814 13.6884 21 12 21C10.3116 21 8.75349 20.814 7.5 20.5002M18 16.4305C16.5341 16.9842 14.3894 17.3333 12 17.3333C9.61061 17.3333 7.46589 16.9842 6 16.4305M4.5 11.6679C5.93143 12.5598 8.75311 13.1667 12 13.1667C15.2469 13.1667 18.0686 12.5598 19.5 11.6679M21 6C21 7.65685 16.9706 9 12 9C7.02944 9 3 7.65685 3 6C3 4.34315 7.02944 3 12 3C16.9706 3 21 4.34315 21 6Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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