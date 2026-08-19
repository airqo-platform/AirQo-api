import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCameroon icon widget (Cameroon.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCameroon extends StatelessWidget {
  /// Creates a AqCameroon icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCameroon({
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
<g clip-path="url(#clip0_1692_54114)">
<path d="M2.53516 6.06787H22.4845V19.3674H2.53516V6.06787Z" fill="#CE1126"/>
<path d="M2.53516 6.06787H9.18494V19.3674H2.53516V6.06787Z" fill="#007A5E"/>
<path d="M15.834 6.06787H22.4838V19.3674H15.834V6.06787Z" fill="#FCD116"/>
<path d="M11.4799 14.148L14.1989 12.1726H10.8381L13.5571 14.148L12.5185 10.9517L11.4799 14.148Z" fill="#FCD116"/>
</g>
<defs>
<clipPath id="clip0_1692_54114">
<rect x="2.53516" y="6.06787" width="19.9495" height="13.2997" rx="1" fill="white"/>
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