import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSeychelles icon widget (Seychelles.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSeychelles extends StatelessWidget {
  /// Creates a AqSeychelles icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSeychelles({
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
<g clip-path="url(#clip0_1692_54002)">
<mask id="mask0_1692_54002" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="2" y="6" width="20" height="14">
<path d="M2.04883 6.33447H21.9983V19.6341H2.04883V6.33447Z" fill="white"/>
</mask>
<g mask="url(#mask0_1692_54002)">
<path d="M2.04883 19.6341V6.33447H28.6482V10.7677L2.04883 19.6341Z" fill="#D92223"/>
<path d="M2.04883 19.6341V6.33447H19.7817L2.04883 19.6341Z" fill="#FCD955"/>
<path d="M2.04883 19.6341V6.33447H10.9153L2.04883 19.6341Z" fill="#003D88"/>
<path d="M2.04883 19.6324L28.6482 15.1992V19.6324H2.04883Z" fill="#007A39"/>
</g>
</g>
<defs>
<clipPath id="clip0_1692_54002">
<rect x="2.04883" y="6.33447" width="19.9495" height="13.2997" rx="1" fill="white"/>
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