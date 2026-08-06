import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCollapse icon widget (Collapse.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCollapse extends StatelessWidget {
  /// Creates a AqCollapse icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCollapse({
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
<path d="M8.625 3V21M3 5.25V5.25C3 4.00736 4.00736 3 5.25 3V3H18.75V3C19.9926 3 21 4.00736 21 5.25V5.25V18.75V18.75C21 19.9926 19.9926 21 18.75 21V21H5.25V21C4.00736 21 3 19.9926 3 18.75V18.75V5.25Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.375 9.75L13.125 12L15.375 14.25" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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