import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMoon02 icon widget (moon-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMoon02 extends StatelessWidget {
  /// Creates a AqMoon02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMoon02({
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
<path d="M21.9548 12.9115C20.5779 15.3267 17.9791 16.9552 15 16.9552C10.5817 16.9552 7 13.3734 7 8.95516C7 5.9758 8.62867 3.37683 11.0443 2C5.96975 2.48114 2 6.75444 2 11.9549C2 17.4778 6.47715 21.9549 12 21.9549C17.2002 21.9549 21.4733 17.9856 21.9548 12.9115Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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