import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSnowflake01 icon widget (snowflake-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSnowflake01 extends StatelessWidget {
  /// Creates a AqSnowflake01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSnowflake01({
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
<path d="M18.0622 8.5L5.93782 15.5M18.0622 8.5L19.1603 4.40192M18.0622 8.5L22.1603 9.59808M5.93782 15.5L1.83974 14.4019M5.93782 15.5L4.83974 19.5981M18.0621 15.4999L5.93774 8.49986M18.0621 15.4999L22.1603 14.4018M18.0621 15.4999L19.1603 19.598M5.93774 8.49986L4.83989 4.40203M5.93774 8.49986L1.83989 9.59819M12 5L12 19M12 5L9 2M12 5L15 2M12 19L9 22M12 19L15 22" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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