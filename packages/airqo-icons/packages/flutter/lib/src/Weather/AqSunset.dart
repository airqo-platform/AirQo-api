import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSunset icon widget (sunset.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSunset extends StatelessWidget {
  /// Creates a AqSunset icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSunset({
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
        '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1541_51223)">
<path d="M4 21H2M6.31412 15.3141L4.8999 13.8999M17.6858 15.3141L19.1 13.8999M22 21H20M7 21C7 18.2386 9.23858 16 12 16C14.7614 16 17 18.2386 17 21M22 25H2M16 8L12 12M12 12L8 8M12 12V5" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1541_51223">
<rect width="24" height="24" fill="white"/>
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