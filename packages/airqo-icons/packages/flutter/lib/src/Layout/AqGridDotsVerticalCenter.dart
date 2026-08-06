import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGridDotsVerticalCenter icon widget (grid-dots-vertical-center.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGridDotsVerticalCenter extends StatelessWidget {
  /// Creates a AqGridDotsVerticalCenter icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGridDotsVerticalCenter({
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
<path d="M3 3H3.01M3 21H3.01M3 16.5H3.01M3 7.5H3.01M7.5 3H7.51M7.5 21H7.51M16.5 3H16.51M16.5 21H16.51M12 3H12.01M12 21H12.01M12 16.5H12.01M12 7.5H12.01M21 3H21.01M21 21H21.01M21 16.5H21.01M21 7.5H21.01M21 12H3" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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