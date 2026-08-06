import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBenin icon widget (Benin.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBenin extends StatelessWidget {
  /// Creates a AqBenin icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBenin({
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
<g clip-path="url(#clip0_1692_54069)">
<path d="M2.09766 5.8501H22.0472V19.1498H2.09766V5.8501Z" fill="#E8112D"/>
<path d="M2.09766 5.8501H22.0472V12.4999H2.09766V5.8501Z" fill="#FCD116"/>
<path d="M2.09766 5.8501H10.0775V19.1498H2.09766V5.8501Z" fill="#008751"/>
</g>
<defs>
<clipPath id="clip0_1692_54069">
<rect x="2.09766" y="5.8501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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