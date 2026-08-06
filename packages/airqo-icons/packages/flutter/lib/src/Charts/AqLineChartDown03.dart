import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLineChartDown03 icon widget (line-chart-down-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLineChartDown03 extends StatelessWidget {
  /// Creates a AqLineChartDown03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLineChartDown03({
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
<path d="M17 15L11.5657 9.56569C11.3677 9.36768 11.2687 9.26867 11.1545 9.23158C11.0541 9.19895 10.9459 9.19895 10.8455 9.23158C10.7313 9.26867 10.6323 9.36768 10.4343 9.56569L8.56569 11.4343C8.36768 11.6323 8.26867 11.7313 8.15451 11.7684C8.05409 11.8011 7.94591 11.8011 7.84549 11.7684C7.73133 11.7313 7.63232 11.6323 7.43431 11.4343L3 7M17 15H13M17 15V11M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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