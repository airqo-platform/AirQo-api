import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMonitor icon widget (Monitor.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMonitor extends StatelessWidget {
  /// Creates a AqMonitor icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMonitor({
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
<path d="M4 6C4 4.34315 5.34315 3 7 3H17C18.6569 3 20 4.34315 20 6V18C20 19.6569 18.6569 21 17 21H7C5.34315 21 4 19.6569 4 18V6Z" stroke="#1C1D20" stroke-width="1.5"/>
<path d="M9.30272 11.6L10.8027 9.6C11.4027 8.8 12.6027 8.8 13.2027 9.6L14.7027 11.6C15.4444 12.5889 14.7388 14 13.5027 14H10.5027C9.26666 14 8.56108 12.5889 9.30272 11.6Z" stroke="#1C1D20" stroke-width="1.5"/>
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