import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDjibouti icon widget (Djibouti.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDjibouti extends StatelessWidget {
  /// Creates a AqDjibouti icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDjibouti({
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
<g clip-path="url(#clip0_1692_54073)">
<path d="M2.04883 6.28564H21.9983V19.5853H2.04883V6.28564Z" fill="#6AB2E7"/>
<path d="M2.04883 12.9355H21.9983V19.5854H2.04883V12.9355Z" fill="#12AD2B"/>
<path d="M2.04883 6.28564V19.5853L7.80777 16.2604L13.5667 12.9355L7.80777 9.61056L2.04883 6.28564Z" fill="white"/>
<path d="M6.45524 11.2725L6.86794 12.5427H8.20349L7.123 13.3277L7.53573 14.5979L6.45524 13.8128L5.37475 14.5979L5.78746 13.3277L4.70697 12.5427H6.04251L6.45524 11.2725Z" fill="#D7141A"/>
</g>
<defs>
<clipPath id="clip0_1692_54073">
<rect x="2.04883" y="6.28564" width="19.9495" height="13.2997" rx="1" fill="white"/>
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