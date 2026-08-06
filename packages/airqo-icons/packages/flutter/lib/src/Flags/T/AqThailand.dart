import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqThailand icon widget (Thailand.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqThailand extends StatelessWidget {
  /// Creates a AqThailand icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqThailand({
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
<g clip-path="url(#clip0_1692_54058)">
<path d="M21.9983 5.55225H2.04883V18.8519H21.9983V5.55225Z" fill="#A51931"/>
<path d="M21.9983 7.76953H2.04883V16.636H21.9983V7.76953Z" fill="#F4F5F8"/>
<path d="M21.9983 9.98584H2.04883V14.4191H21.9983V9.98584Z" fill="#2D2A4A"/>
</g>
<defs>
<clipPath id="clip0_1692_54058">
<rect x="2.04883" y="5.55225" width="19.9495" height="13.2997" rx="1" fill="white"/>
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