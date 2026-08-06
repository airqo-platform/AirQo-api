import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqAlarmClockOff icon widget (alarm-clock-off.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqAlarmClockOff extends StatelessWidget {
  /// Creates a AqAlarmClockOff icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqAlarmClockOff({
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
<path d="M10.5 5.14185C10.991 5.04813 11.493 5 12 5C14.1217 5 16.1566 5.84285 17.6569 7.34315C19.1571 8.84344 20 10.8783 20 13C20 13.507 19.9519 14.009 19.8582 14.5M18.1356 18.1337C17.9844 18.3144 17.8247 18.489 17.6569 18.6569C16.1566 20.1571 14.1217 21 12 21C9.87827 21 7.84344 20.1571 6.34315 18.6569C4.84285 17.1566 4 15.1217 4 13C4 10.8783 4.84285 8.84344 6.34315 7.34315C6.50948 7.17682 6.68238 7.01857 6.86123 6.86865M4 4L2 6M22 6L19 3M6 19L4 21M21 21L3 3" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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