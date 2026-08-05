import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMadagascar icon widget (Madagascar.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMadagascar extends StatelessWidget {
  /// Creates a AqMadagascar icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMadagascar({
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
<g clip-path="url(#clip0_1692_54123)">
<path d="M21.9983 6.24561H2.04883V19.5453H21.9983V6.24561Z" fill="#007E3A"/>
<path d="M21.9983 6.24561H2.04883V12.8954H21.9983V6.24561Z" fill="#FC3D32"/>
<path d="M8.69867 6.24561H2.04883V19.5453H8.69867V6.24561Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54123">
<rect x="2.04883" y="6.24561" width="19.9504" height="13.2997" rx="1" fill="white"/>
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