import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqChile icon widget (Chile.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqChile extends StatelessWidget {
  /// Creates a AqChile icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqChile({
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
<g clip-path="url(#clip0_1692_54021)">
<path d="M2.09766 6.06787H22.0472V19.3675H2.09766V6.06787Z" fill="white"/>
<path d="M2.09766 12.7177V6.06787H8.74749V16.0426L2.09766 12.7177Z" fill="#0039A6"/>
<path d="M2.09766 12.7178H22.0472V19.3676H2.09766V12.7178Z" fill="#D72B1F"/>
<path d="M5.42497 7.72998L6.40231 10.7378L3.84375 8.8789H7.0062L4.44764 10.7378L5.42497 7.72998Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54021">
<rect x="2.09766" y="6.06787" width="19.9495" height="13.2997" rx="1" fill="white"/>
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