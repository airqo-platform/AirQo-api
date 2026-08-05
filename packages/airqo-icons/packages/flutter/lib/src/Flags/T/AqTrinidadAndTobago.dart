import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqTrinidadAndTobago icon widget (Trinidad-and-Tobago.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqTrinidadAndTobago extends StatelessWidget {
  /// Creates a AqTrinidadAndTobago icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqTrinidadAndTobago({
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
<g clip-path="url(#clip0_1692_54155)">
<path d="M22.0003 5.55127H2.05078V18.8509H22.0003V5.55127Z" fill="#DA1A35"/>
<path d="M2.05273 5.55371L15.9008 18.8534H22.0023L8.15414 5.55371H2.05273Z" fill="white"/>
<path d="M2.97266 5.55371L16.8208 18.8534H20.8884L7.04026 5.55371H2.97266Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54155">
<rect x="2.05078" y="5.55225" width="19.9495" height="13.2997" rx="1" fill="white"/>
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