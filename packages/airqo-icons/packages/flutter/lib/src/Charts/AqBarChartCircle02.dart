import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBarChartCircle02 icon widget (bar-chart-circle-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBarChartCircle02 extends StatelessWidget {
  /// Creates a AqBarChartCircle02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBarChartCircle02({
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
<g clip-path="url(#clip0_1541_51914)">
<path d="M8 18V20M12 14V20M16 10V20M22 15C22 20.5228 17.5228 25 12 25C6.47715 25 2 20.5228 2 15C2 9.47715 6.47715 5 12 5C17.5228 5 22 9.47715 22 15Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1541_51914">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
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