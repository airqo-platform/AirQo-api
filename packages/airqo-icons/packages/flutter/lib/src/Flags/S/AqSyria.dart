import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSyria icon widget (Syria.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSyria extends StatelessWidget {
  /// Creates a AqSyria icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSyria({
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
<g clip-path="url(#clip0_1692_53980)">
<path d="M2.04883 6.33398H21.9983V19.6337H2.04883V6.33398Z" fill="black"/>
<path d="M2.04883 6.33398H21.9983V15.2004H2.04883V6.33398Z" fill="white"/>
<path d="M2.04883 6.33398H21.9983V10.7672H2.04883V6.33398Z" fill="#CE1126"/>
<path d="M7.62086 14.6462L8.70119 11.3213L9.78152 14.6462L6.95312 12.5913H10.4492L7.62086 14.6462ZM14.2706 14.6462L15.3509 11.3213L16.4313 14.6462L13.6029 12.5913H17.0989" fill="#007A3D"/>
</g>
<defs>
<clipPath id="clip0_1692_53980">
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