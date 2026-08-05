import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLatvia icon widget (Latvia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLatvia extends StatelessWidget {
  /// Creates a AqLatvia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLatvia({
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
<g clip-path="url(#clip0_1692_54098)">
<path d="M2.04688 6.02783H21.9964V19.3275H2.04688" fill="#9E3039"/>
<path d="M2.04688 11.3472H21.9964V14.0071H2.04688" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54098">
<rect x="2.04688" y="6.02783" width="19.9495" height="13.2997" rx="1" fill="white"/>
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