import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqUserCheck02 icon widget (user-check-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqUserCheck02 extends StatelessWidget {
  /// Creates a AqUserCheck02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqUserCheck02({
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
<g clip-path="url(#clip0_1541_51693)">
<path d="M16 24V22.8C16 21.1198 16 20.2798 15.673 19.638C15.3854 19.0735 14.9265 18.6146 14.362 18.327C13.7202 18 12.8802 18 11.2 18H6.8C5.11984 18 4.27976 18 3.63803 18.327C3.07354 18.6146 2.6146 19.0735 2.32698 19.638C2 20.2798 2 21.1198 2 22.8V24M16 9L18 11L22 7M12.5 10.5C12.5 12.433 10.933 14 9 14C7.067 14 5.5 12.433 5.5 10.5C5.5 8.567 7.067 7 9 7C10.933 7 12.5 8.567 12.5 10.5Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1541_51693">
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