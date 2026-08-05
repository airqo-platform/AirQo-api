import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLink01 icon widget (link-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLink01 extends StatelessWidget {
  /// Creates a AqLink01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLink01({
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
<path d="M12.7076 18.3644L11.2933 19.7786C9.34072 21.7313 6.1749 21.7313 4.22228 19.7786C2.26966 17.826 2.26966 14.6602 4.22228 12.7076L5.63649 11.2933M18.3644 12.7076L19.7786 11.2933C21.7312 9.34072 21.7312 6.1749 19.7786 4.22228C17.826 2.26966 14.6602 2.26966 12.7076 4.22228L11.2933 5.63649M8.50045 15.5004L15.5005 8.50043" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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