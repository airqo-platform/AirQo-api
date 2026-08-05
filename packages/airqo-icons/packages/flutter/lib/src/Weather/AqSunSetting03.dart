import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSunSetting03 icon widget (sun-setting-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSunSetting03 extends StatelessWidget {
  /// Creates a AqSunSetting03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSunSetting03({
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
<path d="M6.06006 20.9125C7.27006 21.4625 8.81006 21.4625 10.0201 20.9125C11.2301 20.3625 12.7701 20.3625 13.9801 20.9125C15.1901 21.4625 16.7301 21.4625 17.9401 20.9125M12 3V5M4 13H2M6.31412 7.31412L4.8999 5.8999M17.6855 7.31412L19.0998 5.8999M22 13H20M7 13C7 10.2386 9.23858 8 12 8C14.7614 8 17 10.2386 17 13M2.1001 17.4125C3.3101 16.8625 4.8501 16.8625 6.0601 17.4125C7.2701 17.9625 8.8101 17.9625 10.0201 17.4125C11.2301 16.8625 12.7701 16.8625 13.9801 17.4125C15.1901 17.9625 16.7301 17.9625 17.9401 17.4125C19.1501 16.8625 20.6901 16.8625 21.9001 17.4125" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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