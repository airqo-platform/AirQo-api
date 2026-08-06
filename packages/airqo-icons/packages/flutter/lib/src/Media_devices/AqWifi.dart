import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqWifi icon widget (wifi.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqWifi extends StatelessWidget {
  /// Creates a AqWifi icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqWifi({
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
<path d="M12.002 19.5H12.012M22.8084 8.70076C19.9615 6.09199 16.1676 4.5 12.0018 4.5C7.8361 4.5 4.04219 6.09199 1.19531 8.70076M4.73389 12.243C6.67201 10.5357 9.21602 9.5 12.0019 9.5C14.7878 9.5 17.3319 10.5357 19.27 12.243M15.7003 15.7751C14.6812 14.9763 13.3971 14.5 12.0018 14.5C10.5854 14.5 9.28368 14.9908 8.25732 15.8116" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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