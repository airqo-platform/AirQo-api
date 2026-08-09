import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRepeat04 icon widget (repeat-04.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRepeat04 extends StatelessWidget {
  /// Creates a AqRepeat04 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRepeat04({
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
<path d="M12 20.4996C16.6944 20.4996 20.5 16.694 20.5 11.9996C20.5 9.17407 19.1213 6.67054 17 5.12501M13 22.3996L11 20.3996L13 18.3996M12 3.49961C7.30558 3.49961 3.5 7.30519 3.5 11.9996C3.5 14.8251 4.87867 17.3287 7 18.8742M11 5.59961L13 3.59961L11 1.59961" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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