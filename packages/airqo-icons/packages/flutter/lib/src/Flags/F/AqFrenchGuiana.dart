import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqFrenchGuiana icon widget (French-Guiana.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqFrenchGuiana extends StatelessWidget {
  /// Creates a AqFrenchGuiana icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqFrenchGuiana({
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
<g clip-path="url(#clip0_1692_54077)">
<path d="M2.02539 5.72119H21.9749V19.0209L2.02539 5.72119Z" fill="#078930"/>
<path d="M2.02539 5.72119L21.9749 19.0209H2.02539V5.72119Z" fill="#FCDD09"/>
<path d="M12.001 10.1543L13.3041 14.1648L9.89258 11.6862H14.1094L10.6979 14.1648L12.001 10.1543Z" fill="#DA121A"/>
</g>
<defs>
<clipPath id="clip0_1692_54077">
<rect x="2.02539" y="5.72119" width="19.9495" height="13.2997" rx="1" fill="white"/>
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