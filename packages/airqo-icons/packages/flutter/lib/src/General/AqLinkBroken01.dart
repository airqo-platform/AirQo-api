import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLinkBroken01 icon widget (link-broken-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLinkBroken01 extends StatelessWidget {
  /// Creates a AqLinkBroken01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLinkBroken01({
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
<path d="M9 4V2M15 20V22M4 9H2M20 15H22M4.91421 4.91421L3.5 3.5M19.0858 19.0858L20.5 20.5M12 17.6569L9.87868 19.7782C8.31658 21.3403 5.78392 21.3403 4.22183 19.7782C2.65973 18.2161 2.65973 15.6834 4.22183 14.1213L6.34315 12M17.6569 12L19.7782 9.87868C21.3403 8.31658 21.3403 5.78392 19.7782 4.22183C18.2161 2.65973 15.6834 2.65973 14.1213 4.22183L12 6.34315" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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