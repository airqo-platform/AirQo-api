import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGuyana icon widget (Guyana.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGuyana extends StatelessWidget {
  /// Creates a AqGuyana icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGuyana({
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
<g clip-path="url(#clip0_1692_53985)">
<path d="M2.02539 5.93848H21.9749V19.2382H2.02539V5.93848Z" fill="#009E49"/>
<path d="M2.02539 6.604L21.9749 12.5889L2.02539 18.5737V6.604Z" fill="white"/>
<path d="M2.02539 7.125L20.2193 12.5892L2.02539 18.0533V7.125Z" fill="#FCD116"/>
<path d="M2.02539 6.604L12.0001 12.5889L2.02539 18.5737V6.604Z" fill="black"/>
<path d="M2.02539 7.30176L10.8371 12.5884L2.02539 17.875V7.30176Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_53985">
<rect x="2.02344" y="5.93848" width="19.9534" height="13.3001" rx="1" fill="white"/>
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