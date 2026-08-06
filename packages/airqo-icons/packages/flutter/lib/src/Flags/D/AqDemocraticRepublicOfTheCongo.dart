import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDemocraticRepublicOfTheCongo icon widget (Democratic-Republic-of-the-Congo.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDemocraticRepublicOfTheCongo extends StatelessWidget {
  /// Creates a AqDemocraticRepublicOfTheCongo icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDemocraticRepublicOfTheCongo({
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
<g clip-path="url(#clip0_1692_54106)">
<path d="M21.9769 6.28564H2.02734V19.5853H21.9769V6.28564Z" fill="#007FFF"/>
<path d="M2.82566 8.94558H4.68839L5.26495 7.08363L5.84151 8.94558H7.70424L6.19632 10.0982L6.77287 11.9602L5.26495 10.8075L3.75702 11.9602L4.33358 10.0982L2.82566 8.94558ZM20.8755 6.28564L2.02734 16.2604V19.5853H3.13611L21.9769 9.61056V6.28564H20.8755Z" fill="#F7D618"/>
<path d="M21.9769 6.28564L2.02734 16.9254V19.5853L21.9769 8.94558V6.28564Z" fill="#CE1021"/>
</g>
<defs>
<clipPath id="clip0_1692_54106">
<rect x="2.02734" y="6.28564" width="19.9504" height="13.2997" rx="1" fill="white"/>
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