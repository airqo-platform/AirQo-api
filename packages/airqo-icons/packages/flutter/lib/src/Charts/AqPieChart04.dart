import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPieChart04 icon widget (pie-chart-04.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPieChart04 extends StatelessWidget {
  /// Creates a AqPieChart04 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPieChart04({
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
<path d="M12 12L2.33178 9.44554C1.70974 11.7999 1.96813 14.3002 3.05847 16.4776C4.14881 18.6549 5.99616 20.3596 8.25395 21.2718L12 12ZM12 12L12.1047 2.00055C9.88558 1.97731 7.72174 2.69293 5.95402 4.0347C4.1863 5.37647 2.91514 7.26815 2.34075 9.41181L12 12ZM22 12C22 17.5228 17.5229 22 12 22C6.47716 22 2.00001 17.5228 2.00001 12C2.00001 6.47715 6.47716 2 12 2C17.5229 2 22 6.47715 22 12Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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