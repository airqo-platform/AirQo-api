import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBulgaria icon widget (Bulgaria.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBulgaria extends StatelessWidget {
  /// Creates a AqBulgaria icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBulgaria({
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
<g clip-path="url(#clip0_1692_54124)">
<path d="M22.1155 5.8501H2.16602V19.1498H22.1155V5.8501Z" fill="white"/>
<path d="M22.1155 10.2832H2.16602V19.1497H22.1155V10.2832Z" fill="#00966E"/>
<path d="M22.1155 14.7158H2.16602V19.149H22.1155V14.7158Z" fill="#D62612"/>
</g>
<defs>
<clipPath id="clip0_1692_54124">
<rect x="2.16602" y="5.8501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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