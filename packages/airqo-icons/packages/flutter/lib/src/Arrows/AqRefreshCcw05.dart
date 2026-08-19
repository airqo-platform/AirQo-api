import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRefreshCcw05 icon widget (refresh-ccw-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRefreshCcw05 extends StatelessWidget {
  /// Creates a AqRefreshCcw05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRefreshCcw05({
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
<path d="M8.54539 19.7687C10.9445 20.8331 13.802 20.7753 16.249 19.3625C20.3145 17.0153 21.7074 11.8168 19.3602 7.7513L19.1102 7.31829M4.63729 16.2514C2.29008 12.1859 3.68301 6.98741 7.7485 4.6402C10.1955 3.22743 13.0529 3.16963 15.4521 4.23399M2.49219 16.3351L5.22424 17.0671L5.95629 14.3351M18.0414 9.66712L18.7735 6.93507L21.5055 7.66712" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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