import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBahamas icon widget (Bahamas.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBahamas extends StatelessWidget {
  /// Creates a AqBahamas icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBahamas({
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
<g clip-path="url(#clip0_1692_54159)">
<path d="M2.02734 5.8501H21.9769V19.1498H2.02734V5.8501Z" fill="#00778B"/>
<path d="M6.46094 10.2827H21.9772V14.7159H6.46094V10.2827Z" fill="#FFC72C"/>
<path d="M13.5453 12.4999L2.02734 19.1498V5.8501L13.5453 12.4999Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54159">
<rect x="2.02734" y="5.8501" width="19.9504" height="13.2997" rx="1" fill="white"/>
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