import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqKuwait icon widget (Kuwait.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqKuwait extends StatelessWidget {
  /// Creates a AqKuwait icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqKuwait({
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
<g clip-path="url(#clip0_1692_54121)">
<path d="M21.9983 5.81006H2.04883V19.1089H21.9983V5.81006Z" fill="#007A3D"/>
<path d="M21.9983 10.2437H2.04883V19.1095H21.9983V10.2437Z" fill="white"/>
<path d="M21.9983 14.6748H2.04883V19.1077H21.9983V14.6748Z" fill="#CE1126"/>
<path d="M2.04883 5.81006L8.69823 10.243V14.6759L2.04883 19.1089V5.81006Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54121">
<rect x="2.04883" y="5.81006" width="19.9495" height="13.2997" rx="1" fill="white"/>
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