import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPalau icon widget (Palau.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPalau extends StatelessWidget {
  /// Creates a AqPalau icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPalau({
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
<g clip-path="url(#clip0_1692_54102)">
<path d="M21.9964 5.68115H2.04688V18.9808H21.9964V5.68115Z" fill="#0099FF"/>
<path d="M10.7718 16.066C12.8376 16.066 14.5123 14.3913 14.5123 12.3255C14.5123 10.2597 12.8376 8.58496 10.7718 8.58496C8.70594 8.58496 7.03125 10.2597 7.03125 12.3255C7.03125 14.3913 8.70594 16.066 10.7718 16.066Z" fill="#FFFF00"/>
</g>
<defs>
<clipPath id="clip0_1692_54102">
<rect x="2.04688" y="5.68115" width="19.9495" height="13.2997" rx="1" fill="white"/>
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