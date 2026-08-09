import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCostaRica icon widget (Costa-Rica.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCostaRica extends StatelessWidget {
  /// Creates a AqCostaRica icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCostaRica({
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
<g clip-path="url(#clip0_1692_54093)">
<path d="M2.6543 6.06787H22.6038V19.3675H2.6543V6.06787Z" fill="#002B7F"/>
<path d="M2.6543 8.28467H22.6038V17.1511H2.6543V8.28467Z" fill="white"/>
<path d="M2.6543 10.501H22.6038V14.9342H2.6543V10.501Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54093">
<rect x="2.6543" y="6.06787" width="19.9495" height="13.2997" rx="1" fill="white"/>
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