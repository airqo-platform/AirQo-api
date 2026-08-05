import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGambia icon widget (Gambia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGambia extends StatelessWidget {
  /// Creates a AqGambia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGambia({
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
<g clip-path="url(#clip0_1692_54099)">
<path d="M2.02344 5.93896H21.973V19.2386H2.02344V5.93896Z" fill="white"/>
<path d="M2.02344 5.93896H21.973V10.3722H2.02344V5.93896Z" fill="#CE1126"/>
<path d="M2.02344 11.1113H21.973V14.0668H2.02344V11.1113Z" fill="#0C1C8C"/>
<path d="M2.02344 14.8047H21.973V19.2379H2.02344V14.8047Z" fill="#3A7728"/>
</g>
<defs>
<clipPath id="clip0_1692_54099">
<rect x="2.02344" y="5.93896" width="19.9495" height="13.2997" rx="1" fill="white"/>
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