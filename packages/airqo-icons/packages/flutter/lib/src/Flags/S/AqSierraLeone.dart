import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSierraLeone icon widget (Sierra-Leone.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSierraLeone extends StatelessWidget {
  /// Creates a AqSierraLeone icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSierraLeone({
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
<g clip-path="url(#clip0_1692_53997)">
<path d="M2.04883 6.33447H21.9983V19.6341H2.04883V6.33447Z" fill="#0072C6"/>
<path d="M2.04883 6.33447H21.9983V15.2009H2.04883V6.33447Z" fill="white"/>
<path d="M2.04883 6.33447H21.9983V10.7677H2.04883V6.33447Z" fill="#1EB53A"/>
</g>
<defs>
<clipPath id="clip0_1692_53997">
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