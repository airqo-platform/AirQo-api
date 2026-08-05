import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqIndonesia icon widget (Indonesia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqIndonesia extends StatelessWidget {
  /// Creates a AqIndonesia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqIndonesia({
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
<g clip-path="url(#clip0_1692_54140)">
<path d="M2.02539 5.76855H21.9749V19.0682H2.02539V5.76855Z" fill="white"/>
<path d="M2.02539 5.76855H21.9749V12.4184H2.02539V5.76855Z" fill="#FF0000"/>
</g>
<defs>
<clipPath id="clip0_1692_54140">
<rect x="2.02539" y="5.76855" width="19.9495" height="13.2997" rx="1" fill="white"/>
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