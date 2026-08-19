import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloud02 icon widget (cloud-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloud02 extends StatelessWidget {
  /// Creates a AqCloud02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloud02({
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
<path d="M6 19C3.79086 19 2 17.2091 2 15C2 13.1358 3.27532 11.5694 5.00111 11.1257C5.00037 11.0839 5 11.042 5 11C5 7.13401 8.13401 4 12 4C15.6099 4 18.5815 6.73249 18.9594 10.2419C20.7284 10.8481 22 12.5255 22 14.5C22 16.9853 19.9853 19 17.5 19C13.7609 19 10.1876 19 6 19Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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