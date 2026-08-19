import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqFinland icon widget (Finland.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqFinland extends StatelessWidget {
  /// Creates a AqFinland icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqFinland({
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
        '''<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54094)">
<path d="M21.973 5.72119H2.02344V19.0209H21.973V5.72119Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M7.56497 5.72119H10.8899V10.7087H7.56497V5.72119ZM7.56497 14.0336V10.7087H2.02344V14.0336H7.56497ZM10.8899 14.0336V10.7087H21.973V14.0336H10.8899ZM10.8899 14.0336H7.56497V19.0209H10.8899V14.0336Z" fill="#003580"/>
<path d="M10.8899 10.7087H7.56497V14.0336H10.8899V10.7087Z" fill="#003580"/>
</g>
<defs>
<clipPath id="clip0_1692_54094">
<rect x="2.02344" y="5.72119" width="19.9495" height="13.2997" rx="1" fill="white"/>
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