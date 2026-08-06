import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGhana icon widget (Ghana.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGhana extends StatelessWidget {
  /// Creates a AqGhana icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGhana({
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
<g clip-path="url(#clip0_1692_54036)">
<path d="M2.02539 5.93896H21.9749V19.2386H2.02539V5.93896Z" fill="#006B3F"/>
<path d="M2.02539 5.93896H21.9749V14.8054H2.02539V5.93896Z" fill="#FCD116"/>
<path d="M2.02539 5.93896H21.9749V10.3722H2.02539V5.93896Z" fill="#CE1126"/>
<path d="M12.003 10.3721L13.4435 14.8059L9.67188 12.0656H14.3341L10.5624 14.8059L12.003 10.3721Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54036">
<rect x="2.02344" y="5.93896" width="19.9551" height="13.2998" rx="1" fill="white"/>
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