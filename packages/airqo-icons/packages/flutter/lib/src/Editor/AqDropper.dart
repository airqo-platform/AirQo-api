import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDropper icon widget (dropper.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDropper extends StatelessWidget {
  /// Creates a AqDropper icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDropper({
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
<path d="M10.5 6.5003L17.5 13.5003M2 22.0003C2 22.0003 6.5 21.5003 9 19.0003L21 7.0003C22.1046 5.89573 22.1046 4.10487 21 3.0003C19.8954 1.89573 18.1046 1.89573 17 3.0003L5 15.0003C2.5 17.5003 2 22.0003 2 22.0003Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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