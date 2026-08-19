import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSunSetting02 icon widget (sun-setting-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSunSetting02 extends StatelessWidget {
  /// Creates a AqSunSetting02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSunSetting02({
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
<path d="M22 19.5H2M20 23H4M12 6V8M4 16H2M6.31412 10.3141L4.8999 8.8999M17.6855 10.3141L19.0998 8.8999M22 16H20M7 16C7 13.2386 9.23858 11 12 11C14.7614 11 17 13.2386 17 16" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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