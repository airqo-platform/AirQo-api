import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqArmenia icon widget (Armenia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqArmenia extends StatelessWidget {
  /// Creates a AqArmenia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqArmenia({
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
        '''<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54160)">
<path d="M2.14258 5.34961H22.0921V18.6493H2.14258V5.34961Z" fill="#F2A800"/>
<path d="M2.14258 5.34961H22.0921V14.2161H2.14258V5.34961Z" fill="#0033A0"/>
<path d="M2.14258 5.34961H22.0921V9.78284H2.14258V5.34961Z" fill="#D90012"/>
</g>
<defs>
<clipPath id="clip0_1692_54160">
<rect x="2.14258" y="5.34961" width="19.9495" height="13.2997" rx="1" fill="white"/>
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