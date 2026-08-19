import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqVenezuela icon widget (Venezuela.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqVenezuela extends StatelessWidget {
  /// Creates a AqVenezuela icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqVenezuela({
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
<g clip-path="url(#clip0_1692_54161)">
<path d="M2.04688 5.98779H21.9964V19.2875H2.04688V5.98779Z" fill="#CF142B"/>
<path d="M2.04688 5.98779H21.9964V14.8542H2.04688V5.98779Z" fill="#00247D"/>
<path d="M2.04688 5.98779H21.9964V10.421H2.04688V5.98779Z" fill="#FFCC00"/>
</g>
<defs>
<clipPath id="clip0_1692_54161">
<rect x="2.04688" y="5.98779" width="19.9495" height="13.2997" rx="1" fill="white"/>
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