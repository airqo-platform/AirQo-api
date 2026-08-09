import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGlasses01 icon widget (glasses-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGlasses01 extends StatelessWidget {
  /// Creates a AqGlasses01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGlasses01({
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
<path d="M10 11.5347C11.2335 10.8218 12.7663 10.8218 13.9999 11.5347M8.82843 9.17157C10.3905 10.7337 10.3905 13.2663 8.82843 14.8284C7.26634 16.3905 4.73367 16.3905 3.17157 14.8284C1.60948 13.2663 1.60948 10.7337 3.17157 9.17157C4.73366 7.60948 7.26633 7.60948 8.82843 9.17157ZM20.8284 9.17157C22.3905 10.7337 22.3905 13.2663 20.8284 14.8284C19.2663 16.3905 16.7337 16.3905 15.1716 14.8284C13.6095 13.2663 13.6095 10.7337 15.1716 9.17157C16.7337 7.60948 19.2663 7.60948 20.8284 9.17157Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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