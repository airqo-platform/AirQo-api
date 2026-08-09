import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqUkraine icon widget (Ukraine.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqUkraine extends StatelessWidget {
  /// Creates a AqUkraine icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqUkraine({
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
<g clip-path="url(#clip0_1692_54154)">
<path d="M21.9964 5.77002H2.04688V19.0697H21.9964V5.77002Z" fill="#005BBB"/>
<path d="M21.9964 12.4194H2.04688V19.0693H21.9964V12.4194Z" fill="#FFD500"/>
</g>
<defs>
<clipPath id="clip0_1692_54154">
<rect x="2.04688" y="5.77002" width="19.9495" height="13.2997" rx="1" fill="white"/>
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