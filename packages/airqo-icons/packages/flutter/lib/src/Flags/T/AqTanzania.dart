import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqTanzania icon widget (Tanzania.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqTanzania extends StatelessWidget {
  /// Creates a AqTanzania icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqTanzania({
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
<g clip-path="url(#clip0_1692_54157)">
<path d="M2.04883 18.8519V5.55225H21.9983L2.04883 18.8519Z" fill="#1EB53A"/>
<path d="M21.9983 5.55225V18.8519H2.04883L21.9983 5.55225Z" fill="#00A3DD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9983 8.71579V5.55225L17.2659 5.55225L2.04883 15.6822V18.8519H6.79414L21.9983 8.71579Z" fill="#FCD116"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9983 7.71678V5.55225L18.7515 5.55226L2.04885 16.6874L2.04883 18.8519H5.29562L21.9983 7.71678Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54157">
<rect x="2.04883" y="5.55225" width="19.9495" height="13.2997" rx="1" fill="white"/>
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