import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPower01 icon widget (power-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPower01 extends StatelessWidget {
  /// Creates a AqPower01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPower01({
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
<path d="M12.0011 2V12M18.3611 6.64C19.6195 7.89879 20.4764 9.50244 20.8234 11.2482C21.1704 12.9939 20.992 14.8034 20.3107 16.4478C19.6295 18.0921 18.4759 19.4976 16.9959 20.4864C15.5159 21.4752 13.776 22.0029 11.9961 22.0029C10.2162 22.0029 8.47625 21.4752 6.99627 20.4864C5.51629 19.4976 4.36274 18.0921 3.68146 16.4478C3.00019 14.8034 2.82179 12.9939 3.16882 11.2482C3.51584 9.50244 4.37272 7.89879 5.6311 6.64" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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