import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSouthSudan icon widget (South-Sudan.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSouthSudan extends StatelessWidget {
  /// Creates a AqSouthSudan icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSouthSudan({
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
<g clip-path="url(#clip0_1692_54158)">
<path d="M2.04883 6.33398H21.9983V19.6337H2.04883V6.33398Z" fill="white"/>
<path d="M2.04883 6.33398H21.9983V10.3006H3.62379L2.04883 6.33398Z" fill="black"/>
<path d="M2.04906 11H21.9986V14.9666H2.04906V11Z" fill="#DA121A"/>
<path d="M3.62402 15.6675H21.9986V19.6341H2.04906L3.62402 15.6675Z" fill="#078930"/>
<path d="M13.5666 12.9838L2.04883 19.6337V6.33398L13.5666 12.9838Z" fill="#0F47AF"/>
<path d="M3.66406 12.9839L7.6746 14.287L5.19608 10.8755V15.0923L7.6746 11.6808L3.66406 12.9839Z" fill="#FCDD09"/>
</g>
<defs>
<clipPath id="clip0_1692_54158">
<rect x="2.04688" y="6.33398" width="19.9534" height="13.3001" rx="1" fill="white"/>
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