import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGlobe01 icon widget (globe-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGlobe01 extends StatelessWidget {
  /// Creates a AqGlobe01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGlobe01({
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
<path d="M18.6317 2.36914C23.1227 6.86017 23.1227 14.1416 18.6317 18.6326C14.3308 22.9334 7.47094 23.1156 2.95335 19.179C2.75634 19.0073 2.65783 18.9215 2.61336 18.8041C2.57595 18.7054 2.57176 18.5834 2.60232 18.4823C2.63863 18.3622 2.73705 18.2637 2.93388 18.0669L5.14913 15.8517M17.9999 10.5009C17.9999 14.643 14.6421 18.0009 10.4999 18.0009C6.35779 18.0009 2.99992 14.643 2.99992 10.5009C2.99992 6.35873 6.35779 3.00087 10.4999 3.00087C14.6421 3.00087 17.9999 6.35873 17.9999 10.5009Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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