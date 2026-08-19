import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGuineaBissau icon widget (Guinea-Bissau.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGuineaBissau extends StatelessWidget {
  /// Creates a AqGuineaBissau icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGuineaBissau({
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
<g clip-path="url(#clip0_1692_53987)">
<path d="M21.9749 5.93896H2.02539V19.2386H21.9749V5.93896Z" fill="#FCD116"/>
<path d="M21.9749 12.5894H2.02539V19.2392H21.9749V12.5894Z" fill="#009E49"/>
<path d="M9.78354 5.93896H2.02539V19.2386H9.78354V5.93896Z" fill="#CE1126"/>
<path d="M5.90542 10.8379L6.34093 12.1783H7.75029L6.6101 13.0067L7.04561 14.347L5.90542 13.5186L4.76523 14.347L5.20074 13.0067L4.06055 12.1783H5.4699L5.90542 10.8379Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_53987">
<rect x="2.02539" y="5.93896" width="19.9495" height="13.2997" rx="1" fill="white"/>
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