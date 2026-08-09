import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSwitzerland icon widget (Switzerland.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSwitzerland extends StatelessWidget {
  /// Creates a AqSwitzerland icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSwitzerland({
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
<g clip-path="url(#clip0_1692_53981)">
<path d="M2.04883 6.33398H21.9983V19.6337H2.04883V6.33398Z" fill="#FF0000"/>
<path d="M10.7939 8.82861H13.2875V11.7379H16.1969V14.2316H13.2875V17.1409H10.7939V14.2316H7.88455V11.7379H10.7939V8.82861Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_53981">
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