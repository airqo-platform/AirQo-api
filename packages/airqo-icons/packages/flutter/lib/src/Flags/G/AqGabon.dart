import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGabon icon widget (Gabon.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGabon extends StatelessWidget {
  /// Creates a AqGabon icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGabon({
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
        '''<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54138)">
<path d="M2.02539 5.93896H21.9749V19.2386H2.02539V5.93896Z" fill="#3A75C4"/>
<path d="M2.02539 5.93896H21.9749V14.8054H2.02539V5.93896Z" fill="#FCD116"/>
<path d="M2.02539 5.93896H21.9749V10.3722H2.02539V5.93896Z" fill="#009E60"/>
</g>
<defs>
<clipPath id="clip0_1692_54138">
<rect x="2.02539" y="5.93896" width="19.9504" height="13.2997" rx="1" fill="white"/>
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