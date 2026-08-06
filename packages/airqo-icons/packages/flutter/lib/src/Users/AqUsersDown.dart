import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqUsersDown icon widget (users-down.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqUsersDown extends StatelessWidget {
  /// Creates a AqUsersDown icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqUsersDown({
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
<g clip-path="url(#clip0_1541_51098)">
<path d="M16 21L19 24M19 24L22 21M19 24V18M15.5 6.29076C16.9659 6.88415 18 8.32131 18 10C18 11.6787 16.9659 13.1159 15.5 13.7092M12 18H8C6.13623 18 5.20435 18 4.46927 18.3045C3.48915 18.7105 2.71046 19.4892 2.30448 20.4693C2 21.2044 2 22.1362 2 24M13.5 10C13.5 12.2091 11.7091 14 9.5 14C7.29086 14 5.5 12.2091 5.5 10C5.5 7.79086 7.29086 6 9.5 6C11.7091 6 13.5 7.79086 13.5 10Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1541_51098">
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