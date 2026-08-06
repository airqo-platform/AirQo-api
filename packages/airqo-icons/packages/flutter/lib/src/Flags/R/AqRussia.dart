import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRussia icon widget (Russia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRussia extends StatelessWidget {
  /// Creates a AqRussia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRussia({
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
<g clip-path="url(#clip0_1692_54066)">
<path d="M21.9983 6.1167H2.04883V12.7664H21.9983V6.1167Z" fill="white"/>
<path d="M21.9983 12.7671H2.04883V19.4168H21.9983V12.7671Z" fill="#D52B1E"/>
<path d="M21.9983 10.5498H2.04883V14.9829H21.9983V10.5498Z" fill="#0039A6"/>
</g>
<defs>
<clipPath id="clip0_1692_54066">
<rect x="2.04883" y="6.1167" width="19.9495" height="13.2997" rx="1" fill="white"/>
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