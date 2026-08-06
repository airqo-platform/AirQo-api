import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqArrowCircleBrokenUpRight icon widget (arrow-circle-broken-up-right.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqArrowCircleBrokenUpRight extends StatelessWidget {
  /// Creates a AqArrowCircleBrokenUpRight icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqArrowCircleBrokenUpRight({
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
<path d="M2.33944 14.5895C1.44852 11.2533 2.3117 7.54616 4.92899 4.92887C8.83424 1.02363 15.1659 1.02363 19.0711 4.92887C22.9764 8.83411 22.9764 15.1658 19.0711 19.071C16.4538 21.6883 12.7467 22.5515 9.41051 21.6606M15.0002 15V9.00004M15.0002 9.00004H9.0002M15.0002 9.00004L5.00001 19" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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