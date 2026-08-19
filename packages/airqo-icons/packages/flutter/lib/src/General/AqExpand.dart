import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqExpand icon widget (Expand.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqExpand extends StatelessWidget {
  /// Creates a AqExpand icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqExpand({
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
<path d="M15.375 3V21M21 5.25V5.25C21 4.00736 19.9926 3 18.75 3V3H5.25V3C4.00736 3 3 4.00736 3 5.25V5.25V18.75V18.75C3 19.9926 4.00736 21 5.25 21V21H18.75V21C19.9926 21 21 19.9926 21 18.75V18.75V5.25Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.625 9.75L10.875 12L8.625 14.25" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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