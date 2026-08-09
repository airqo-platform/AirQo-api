import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloud01 icon widget (cloud-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloud01 extends StatelessWidget {
  /// Creates a AqCloud01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloud01({
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
<path d="M6.5 22C4.01472 22 2 19.9853 2 17.5C2 15.1564 3.79151 13.2313 6.07974 13.0194C6.54781 10.1721 9.02024 8 12 8C14.9798 8 17.4522 10.1721 17.9203 13.0194C20.2085 13.2313 22 15.1564 22 17.5C22 19.9853 19.9853 22 17.5 22C13.1102 22 10.3433 22 6.5 22Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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