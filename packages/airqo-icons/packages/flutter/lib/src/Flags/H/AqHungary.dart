import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqHungary icon widget (Hungary.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqHungary extends StatelessWidget {
  /// Creates a AqHungary icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqHungary({
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
<g clip-path="url(#clip0_1692_54112)">
<path d="M21.973 6.15674H2.02344V19.4564H21.973V6.15674Z" fill="#477050"/>
<path d="M21.973 6.15674H2.02344V15.0232H21.973V6.15674Z" fill="white"/>
<path d="M21.973 6.15674H2.02344V10.59H21.973V6.15674Z" fill="#CE2939"/>
</g>
<defs>
<clipPath id="clip0_1692_54112">
<rect x="2.02344" y="6.15674" width="19.9495" height="13.2997" rx="1" fill="white"/>
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