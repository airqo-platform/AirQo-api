import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBatteryCharging02 icon widget (battery-charging-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBatteryCharging02 extends StatelessWidget {
  /// Creates a AqBatteryCharging02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBatteryCharging02({
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
<path d="M9.5 18L13.5 12H7.5L11.5 6M22 13V11M14 18H14.2C15.8802 18 16.7202 18 17.362 17.673C17.9265 17.3854 18.3854 16.9265 18.673 16.362C19 15.7202 19 14.8802 19 13.2V10C19 9.07003 19 8.60504 18.8978 8.22354C18.6204 7.18827 17.8117 6.37962 16.7765 6.10222C16.395 6 15.93 6 15 6M7 6H6.8C5.11984 6 4.27976 6 3.63803 6.32698C3.07354 6.6146 2.6146 7.07354 2.32698 7.63803C2 8.27976 2 9.11984 2 10.8V14C2 14.93 2 15.395 2.10222 15.7765C2.37962 16.8117 3.18827 17.6204 4.22354 17.8978C4.60504 18 5.07003 18 6 18" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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