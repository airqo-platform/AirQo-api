import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqInfinity icon widget (infinity.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqInfinity extends StatelessWidget {
  /// Creates a AqInfinity icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqInfinity({
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
<path d="M18.1777 8C23.2737 8 23.2737 16 18.1777 16C13.0827 16 11.0447 8 5.43875 8C0.85375 8 0.85375 16 5.43875 16C11.0447 16 13.0828 8 18.1788 8H18.1777Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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