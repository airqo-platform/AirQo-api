import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloudSun03 icon widget (cloud-sun-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloudSun03 extends StatelessWidget {
  /// Creates a AqCloudSun03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloudSun03({
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
<path d="M3.15003 11C3.05165 10.5153 3 10.0137 3 9.5C3 5.35786 6.35786 2 10.5 2C14.3031 2 17.445 4.83064 17.9339 8.5M6 22C3.79086 22 2 20.2091 2 18C2 15.7909 3.79086 14 6 14C6.11333 14 6.22556 14.0047 6.3365 14.014C7.15622 11.6763 9.38235 10 12 10C14.2248 10 16.1668 11.2109 17.2029 13.0097C17.3011 13.0033 17.4002 13 17.5 13C19.9853 13 22 15.0147 22 17.5C22 19.9853 19.9853 22 17.5 22C13.7633 22 10.0546 22 6 22Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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