import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLuxembourg icon widget (Luxembourg.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLuxembourg extends StatelessWidget {
  /// Creates a AqLuxembourg icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLuxembourg({
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
        '''<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54004)">
<path d="M22.0003 12.6782H2.05078V19.3281H22.0003V12.6782Z" fill="#00A1DE"/>
<path d="M22.0003 6.02783H2.05078V12.6777H22.0003V6.02783Z" fill="#ED2939"/>
<path d="M22.0003 10.4609H2.05078V14.8942H22.0003V10.4609Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54004">
<rect x="2.05078" y="6.02783" width="19.9495" height="13.2997" rx="1" fill="white"/>
</clipPath>
</defs>
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