import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqEstonia icon widget (Estonia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqEstonia extends StatelessWidget {
  /// Creates a AqEstonia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqEstonia({
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
<g clip-path="url(#clip0_1692_54039)">
<path d="M21.9749 5.50342H2.02539V18.8031H21.9749V5.50342Z" fill="white"/>
<path d="M21.9749 5.50342H2.02539V14.3699H21.9749V5.50342Z" fill="black"/>
<path d="M21.9749 5.50342H2.02539V9.93664H21.9749V5.50342Z" fill="#0072CE"/>
</g>
<defs>
<clipPath id="clip0_1692_54039">
<rect x="2.02344" y="5.50342" width="19.9551" height="13.2998" rx="1" fill="white"/>
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