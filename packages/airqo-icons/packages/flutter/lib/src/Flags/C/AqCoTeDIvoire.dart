import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCoTeDIvoire icon widget (Co-te-d-Ivoire.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCoTeDIvoire extends StatelessWidget {
  /// Creates a AqCoTeDIvoire icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCoTeDIvoire({
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
<g clip-path="url(#clip0_1692_54148)">
<path d="M2.2207 6.44043H22.1702V19.7401H2.2207V6.44043Z" fill="#009E60"/>
<path d="M2.2207 6.44043H15.5204V19.7401H2.2207V6.44043Z" fill="white"/>
<path d="M2.2207 6.44043H8.87054V19.7401H2.2207V6.44043Z" fill="#F77F00"/>
</g>
<defs>
<clipPath id="clip0_1692_54148">
<rect x="2.16602" y="6.06787" width="19.9495" height="13.2997" rx="1" fill="white"/>
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