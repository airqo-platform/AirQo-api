import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGermany icon widget (Germany.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGermany extends StatelessWidget {
  /// Creates a AqGermany icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGermany({
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
<g clip-path="url(#clip0_1692_54054)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.02539 5.93945H21.9749V10.3727H2.02539V5.93945Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.02539 10.3726H21.9749V14.8058H2.02539V10.3726Z" fill="#CC2229"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.02539 14.8052H21.9749V19.2384H2.02539V14.8052Z" fill="#F2CA30"/>
</g>
<defs>
<clipPath id="clip0_1692_54054">
<rect x="2.02539" y="5.93896" width="19.9495" height="13.2997" rx="1" fill="white"/>
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