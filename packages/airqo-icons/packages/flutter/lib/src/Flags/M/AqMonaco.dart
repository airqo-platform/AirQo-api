import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMonaco icon widget (Monaco.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMonaco extends StatelessWidget {
  /// Creates a AqMonaco icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMonaco({
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
<g clip-path="url(#clip0_1692_54007)">
<path d="M2.04883 6.24561H21.9983V19.5453H2.04883V6.24561Z" fill="white"/>
<path d="M2.04883 6.24561H21.9983V12.8954H2.04883V6.24561Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54007">
<rect x="2.04883" y="6.24561" width="19.9495" height="13.2997" rx="1" fill="white"/>
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