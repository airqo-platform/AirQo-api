import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqColombia icon widget (Colombia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqColombia extends StatelessWidget {
  /// Creates a AqColombia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqColombia({
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
<g clip-path="url(#clip0_1692_54022)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.63086 6.06787H22.5804V19.3675H2.63086V6.06787Z" fill="#FFF22D"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.63086 16.0215H22.5804V19.3675H2.63086V16.0215Z" fill="#CC2229"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.63086 12.7183H22.5804V16.0222H2.63086V12.7183Z" fill="#33348E"/>
</g>
<defs>
<clipPath id="clip0_1692_54022">
<rect x="2.63086" y="6.06787" width="19.9495" height="13.2997" rx="1" fill="white"/>
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