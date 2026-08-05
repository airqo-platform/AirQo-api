import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqNorthKorea icon widget (North-Korea.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqNorthKorea extends StatelessWidget {
  /// Creates a AqNorthKorea icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqNorthKorea({
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
<g clip-path="url(#clip0_1692_54005)">
<path d="M22.0003 5.46338H2.05078V18.7631H22.0003V5.46338Z" fill="#024FA2"/>
<path d="M22.0003 7.68018H2.05078V16.5466H22.0003V7.68018Z" fill="white"/>
<path d="M22.0003 8.04883H2.05078V16.1764H22.0003V8.04883Z" fill="#ED1C27"/>
<path d="M8.69983 15.07C10.3323 15.07 11.6557 13.7466 11.6557 12.1141C11.6557 10.4816 10.3323 9.1582 8.69983 9.1582C7.06733 9.1582 5.74393 10.4816 5.74393 12.1141C5.74393 13.7466 7.06733 15.07 8.69983 15.07Z" fill="white"/>
<path d="M8.696 9.25L9.33896 11.2285L11.4193 11.2286L9.73632 12.4515L10.3791 14.4301L8.696 13.2074L7.01288 14.4301L7.65568 12.4515L5.97266 11.2286L8.05305 11.2285L8.696 9.25Z" fill="#ED1C27"/>
</g>
<defs>
<clipPath id="clip0_1692_54005">
<rect x="2.05078" y="5.46338" width="19.9495" height="13.2997" rx="1" fill="white"/>
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