import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSignal01 icon widget (signal-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSignal01 extends StatelessWidget {
  /// Creates a AqSignal01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSignal01({
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
<path d="M16.2426 7.75811C18.5858 10.1013 18.5858 13.9002 16.2426 16.2434M7.75736 16.2434C5.41421 13.9002 5.41421 10.1012 7.75736 7.75808M4.92893 19.0718C1.02369 15.1666 1.02369 8.83493 4.92893 4.92969M19.0711 4.92973C22.9763 8.83498 22.9763 15.1666 19.0711 19.0719M14 12.0008C14 13.1053 13.1046 14.0008 12 14.0008C10.8954 14.0008 10 13.1053 10 12.0008C10 10.8962 10.8954 10.0008 12 10.0008C13.1046 10.0008 14 10.8962 14 12.0008Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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