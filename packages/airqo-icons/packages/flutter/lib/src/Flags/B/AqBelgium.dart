import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBelgium icon widget (Belgium.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBelgium extends StatelessWidget {
  /// Creates a AqBelgium icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBelgium({
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
<g clip-path="url(#clip0_1692_54030)">
<path d="M2.58398 5.8501H22.5335V19.1498H2.58398V5.8501Z" fill="#EF3340"/>
<path d="M2.58398 5.8501H15.8837V19.1498H2.58398V5.8501Z" fill="#FDDA25"/>
<path d="M2.58398 5.8501H9.23382V19.1498H2.58398V5.8501Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54030">
<rect x="2.58398" y="5.8501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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