import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqWifiOff icon widget (wifi-off.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqWifiOff extends StatelessWidget {
  /// Creates a AqWifiOff icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqWifiOff({
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
<path d="M15.3139 10C16.6822 10.4263 17.9643 11.1191 19.082 12.05M22.5819 8.49997C19.6595 5.92394 15.8976 4.50262 12.0019 4.50262C11.3969 4.50262 10.7951 4.5369 10.1992 4.60447M8.53174 15.61C9.54694 14.8888 10.7614 14.5013 12.0067 14.5013C13.2521 14.5013 14.4665 14.8888 15.4817 15.61M12.002 19.5H12.012M1.19531 8.70076C2.52892 7.47869 4.07034 6.47975 5.76046 5.76306M4.73389 12.243C6.13129 11.012 7.84368 10.1302 9.7346 9.73393M15.7003 15.7751C14.6812 14.9763 13.3971 14.5 12.0018 14.5C10.5854 14.5 9.28368 14.9908 8.25732 15.8116M3.00195 3L21.002 21" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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