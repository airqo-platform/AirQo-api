import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRomania icon widget (Romania.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRomania extends StatelessWidget {
  /// Creates a AqRomania icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRomania({
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
<g clip-path="url(#clip0_1692_54119)">
<path d="M21.9962 6.1167H2.04688V19.4163H21.9962V6.1167Z" fill="#002B7F"/>
<path d="M21.9949 6.1167H8.69531V19.4163H21.9949V6.1167Z" fill="#FCD116"/>
<path d="M21.9955 6.1167H15.3457V19.4163H21.9955V6.1167Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54119">
<rect x="2.04688" y="6.1167" width="19.9495" height="13.2997" rx="1" fill="white"/>
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