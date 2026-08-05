import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBotswana icon widget (Botswana.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBotswana extends StatelessWidget {
  /// Creates a AqBotswana icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBotswana({
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
<g clip-path="url(#clip0_1692_54003)">
<path d="M22.5804 5.8501H2.63086V19.1498H22.5804V5.8501Z" fill="#6DA9D2"/>
<path d="M22.5803 10.8379H2.63077V14.1628H22.5803V10.8379Z" fill="white"/>
<path d="M22.5803 11.3926H2.63077V13.6092H22.5803V11.3926Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54003">
<rect x="2.63086" y="5.8501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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