import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqJordan icon widget (Jordan.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqJordan extends StatelessWidget {
  /// Creates a AqJordan icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqJordan({
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
<g clip-path="url(#clip0_1692_54071)">
<path d="M2.04883 5.59229H21.9983V18.892H2.04883V5.59229Z" fill="white"/>
<path d="M2.04883 5.59229H21.9983V10.0255H2.04883V5.59229Z" fill="black"/>
<path d="M2.04883 14.457H21.9983V18.8903H2.04883V14.457Z" fill="#007A3D"/>
<path d="M15.3485 12.2421L2.04883 18.892V5.59229L15.3485 12.2421ZM6.15748 11.2921L5.95165 11.8146L5.41597 11.651L5.69568 12.1366L5.23125 12.4532L5.78804 12.5377L5.74582 13.0971L6.15748 12.7171L6.57177 13.0971L6.52955 12.5377L7.08371 12.4532L6.62191 12.1366L6.90163 11.651L6.36594 11.8146L6.15748 11.2921Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54071">
<rect x="2.04883" y="5.59229" width="19.9495" height="13.2997" rx="1" fill="white"/>
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