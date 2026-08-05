import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqFaroeIslands icon widget (Faroe-Islands.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqFaroeIslands extends StatelessWidget {
  /// Creates a AqFaroeIslands icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqFaroeIslands({
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
<g clip-path="url(#clip0_1692_54128)">
<path d="M21.9749 5.72119H2.02539V19.0209H21.9749V5.72119Z" fill="white"/>
<path d="M10.3377 5.72119H7.01277V19.0209H10.3377V5.72119Z" fill="#005EB8"/>
<path d="M21.9749 10.7086H2.02539V14.0335H21.9749V10.7086Z" fill="#005EB8"/>
<path d="M9.50646 5.72119H7.844V19.0209H9.50646V5.72119Z" fill="#EF3340"/>
<path d="M21.9749 11.5398H2.02539V13.2023H21.9749V11.5398Z" fill="#EF3340"/>
</g>
<defs>
<clipPath id="clip0_1692_54128">
<rect x="2.02539" y="5.72119" width="19.9504" height="13.2997" rx="1" fill="white"/>
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