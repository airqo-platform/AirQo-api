import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqALand icon widget (A-land.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqALand extends StatelessWidget {
  /// Creates a AqALand icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqALand({
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
<g clip-path="url(#clip0_1692_54055)">
<path d="M2.51172 5.3335H22.5117V18.6668H2.51172V5.3335Z" fill="#0064AD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M8.78623 10.0394V5.3335H12.7078V10.0394H22.5117V13.9609H12.7078V18.6668H8.78623V13.9609H2.51172V10.0394H8.78623Z" fill="#FFD300"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M9.9627 11.2158V5.3335H11.5313V11.2158H22.5117V12.7845H11.5313V18.6668H9.9627V12.7845H2.51172V11.2158H9.9627Z" fill="#DA0E15"/>
</g>
<defs>
<clipPath id="clip0_1692_54055">
<rect x="2.51172" y="5.3335" width="20" height="13.3333" rx="1" fill="white"/>
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