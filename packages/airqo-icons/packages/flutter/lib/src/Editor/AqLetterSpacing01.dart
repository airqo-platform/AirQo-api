import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLetterSpacing01 icon widget (letter-spacing-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLetterSpacing01 extends StatelessWidget {
  /// Creates a AqLetterSpacing01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLetterSpacing01({
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
<path d="M9 13L15 13M7 17L11.2717 7.60225C11.5031 7.09323 11.6188 6.83872 11.7791 6.75976C11.9184 6.69115 12.0816 6.69115 12.2209 6.75976C12.3812 6.83872 12.4969 7.09323 12.7283 7.60225L17 17M21 3V21M3 3L3 21" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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