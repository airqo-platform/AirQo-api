import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqFrance icon widget (France.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqFrance extends StatelessWidget {
  /// Creates a AqFrance icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqFrance({
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
<g clip-path="url(#clip0_1692_54170)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9749 19.0209V5.72119H2.02539V19.0209H21.9749Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M8.62868 19.0209V5.72119H2.02539V19.0209H8.62868Z" fill="#27569F"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9724 19.0209V5.72119H15.3691V19.0209H21.9724Z" fill="#CC2136"/>
</g>
<defs>
<clipPath id="clip0_1692_54170">
<rect x="2.02539" y="5.72119" width="19.9495" height="13.2997" rx="1" fill="white"/>
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