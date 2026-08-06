import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBahrain icon widget (Bahrain.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBahrain extends StatelessWidget {
  /// Creates a AqBahrain icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBahrain({
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
<g clip-path="url(#clip0_1692_54125)">
<path d="M2.53516 5.8501H22.4847V19.1498H2.53516" fill="white"/>
<path d="M22.4817 5.8501H7.51953L10.512 7.18007L7.51953 8.51003L10.512 9.84L7.51953 11.17L10.512 12.4999L7.51953 13.8299L10.512 15.1599L7.51953 16.4898L10.512 17.8198L7.51953 19.1498H22.4817" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54125">
<rect x="2.53516" y="5.8501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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