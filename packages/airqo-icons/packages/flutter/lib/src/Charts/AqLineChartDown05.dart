import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLineChartDown05 icon widget (line-chart-down-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLineChartDown05 extends StatelessWidget {
  /// Creates a AqLineChartDown05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLineChartDown05({
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
<path d="M6 10L9.43431 13.4343C9.63232 13.6323 9.73133 13.7313 9.84549 13.7684C9.94591 13.8011 10.0541 13.8011 10.1545 13.7684C10.2687 13.7313 10.3677 13.6323 10.5657 13.4343L13.4343 10.5657C13.6323 10.3677 13.7313 10.2687 13.8455 10.2316C13.9459 10.1989 14.0541 10.1989 14.1545 10.2316C14.2687 10.2687 14.3677 10.3677 14.5657 10.5657L18 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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