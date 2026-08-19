import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSenegal icon widget (Senegal.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSenegal extends StatelessWidget {
  /// Creates a AqSenegal icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSenegal({
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
<g clip-path="url(#clip0_1692_54006)">
<path d="M22.0003 6.33447H2.05078V19.6341H22.0003V6.33447Z" fill="#00853F"/>
<path d="M21.9989 6.33447H8.69922V19.6341H21.9989V6.33447Z" fill="#FDEF42"/>
<path d="M21.9994 6.33447H15.3496V19.6341H21.9994V6.33447Z" fill="#E31B23"/>
<path d="M12.0264 10.7676L12.5241 12.2994H14.1348L12.8317 13.2462L13.3295 14.778L12.0264 13.8313L10.7233 14.778L11.221 13.2462L9.91797 12.2994H11.5287L12.0264 10.7676Z" fill="#00853F"/>
</g>
<defs>
<clipPath id="clip0_1692_54006">
<rect x="2.05078" y="6.33447" width="19.9495" height="13.2997" rx="1" fill="white"/>
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