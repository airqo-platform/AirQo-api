import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqArrowCircleBrokenUp icon widget (arrow-circle-broken-up.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqArrowCircleBrokenUp extends StatelessWidget {
  /// Creates a AqArrowCircleBrokenUp icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqArrowCircleBrokenUp({
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
<path d="M7 20.6621C4.01099 18.9331 2 15.7013 2 11.9999C2 6.47709 6.47715 1.99994 12 1.99994C17.5228 1.99994 22 6.47709 22 11.9999C22 15.7014 19.989 18.9331 17 20.6621M16 12L12 8.00001M12 8.00001L8 12M12 8.00001V22" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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