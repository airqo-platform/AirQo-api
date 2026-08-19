import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSaintLucia icon widget (Saint-Lucia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSaintLucia extends StatelessWidget {
  /// Creates a AqSaintLucia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSaintLucia({
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
<g clip-path="url(#clip0_1692_54100)">
<path d="M2.04883 6.33447H21.9983V19.6341H2.04883V6.33447Z" fill="#66CCFF"/>
<path d="M12.0222 8.88135L15.3471 17.1009L12.0222 16.316L8.69727 17.1009L12.0222 8.88135Z" fill="white"/>
<path d="M12.0244 9.99219L14.584 16.3194H9.46484L12.0244 9.99219Z" fill="black"/>
<path d="M12.0226 12.9922L15.348 17.1025H8.6972L12.0226 12.9922Z" fill="#FCD116"/>
</g>
<defs>
<clipPath id="clip0_1692_54100">
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