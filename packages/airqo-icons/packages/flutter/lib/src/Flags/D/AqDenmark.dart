import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDenmark icon widget (Denmark.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDenmark extends StatelessWidget {
  /// Creates a AqDenmark icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDenmark({
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
<g clip-path="url(#clip0_1692_54089)">
<path d="M2.53516 6.28564H22.4847V19.5853H2.53516V6.28564Z" fill="#C60C30"/>
<path d="M2.53516 11.9855H8.23502V6.28564H10.135V11.9855H22.4847V13.8855H10.135V19.5853H8.23502V13.8855H2.53516V11.9855Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54089">
<rect x="2.53516" y="6.28564" width="19.9495" height="13.2997" rx="1" fill="white"/>
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