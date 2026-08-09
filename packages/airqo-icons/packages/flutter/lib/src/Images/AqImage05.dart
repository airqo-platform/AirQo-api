import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqImage05 icon widget (image-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqImage05 extends StatelessWidget {
  /// Creates a AqImage05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqImage05({
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
<path d="M19.0011 21H20.0115C20.9826 21 21.4682 21 21.7359 20.7975C21.9691 20.6211 22.1134 20.3515 22.1308 20.0596C22.1508 19.7246 21.8815 19.3205 21.3428 18.5125L18.3324 13.9969C17.8873 13.3292 17.6647 12.9954 17.3842 12.8791C17.1389 12.7773 16.8633 12.7773 16.618 12.8791C16.3375 12.9954 16.115 13.3292 15.6698 13.9969L14.9256 15.1132M19.0011 21L11.3166 9.90018C10.8747 9.26182 10.6537 8.94264 10.3777 8.83044C10.1362 8.73228 9.86599 8.73228 9.62454 8.83044C9.34852 8.94264 9.12755 9.26182 8.68561 9.90018L2.73932 18.4893C2.17629 19.3025 1.89478 19.7092 1.9108 20.0473C1.92476 20.3419 2.06798 20.6152 2.30219 20.7943C2.57112 21 3.06569 21 4.05482 21H19.0011ZM21.0011 6C21.0011 7.65685 19.658 9 18.0011 9C16.3443 9 15.0011 7.65685 15.0011 6C15.0011 4.34315 16.3443 3 18.0011 3C19.658 3 21.0011 4.34315 21.0011 6Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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