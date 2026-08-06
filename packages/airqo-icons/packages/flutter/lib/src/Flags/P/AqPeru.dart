import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPeru icon widget (Peru.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPeru extends StatelessWidget {
  /// Creates a AqPeru icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPeru({
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
<g clip-path="url(#clip0_1692_54026)">
<path d="M21.9983 5.68115H2.04883V18.9808H21.9983V5.68115Z" fill="#D91023"/>
<path d="M15.3471 5.68115H8.69727V18.9808H15.3471V5.68115Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54026">
<rect x="2.04883" y="5.68115" width="19.9495" height="13.2997" rx="1" fill="white"/>
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