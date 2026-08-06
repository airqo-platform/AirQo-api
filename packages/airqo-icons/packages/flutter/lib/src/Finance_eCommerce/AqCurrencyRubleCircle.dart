import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCurrencyRubleCircle icon widget (currency-ruble-circle.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCurrencyRubleCircle extends StatelessWidget {
  /// Creates a AqCurrencyRubleCircle icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCurrencyRubleCircle({
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
<path d="M9.5 6.5H14C15.3807 6.5 16.5 7.61929 16.5 9C16.5 10.3807 15.3807 11.5 14 11.5H9.5V6.5ZM9.5 6.5V17.5M9.75 11.5H8M13 14.75H8M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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