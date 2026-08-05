import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDistributeSpacingVertical icon widget (distribute-spacing-vertical.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDistributeSpacingVertical extends StatelessWidget {
  /// Creates a AqDistributeSpacingVertical icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDistributeSpacingVertical({
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
<path d="M21 3H3M21 21H3M5 12C5 11.0681 5 10.6022 5.15224 10.2346C5.35523 9.74458 5.74458 9.35523 6.23463 9.15224C6.60218 9 7.06812 9 8 9L16 9C16.9319 9 17.3978 9 17.7654 9.15224C18.2554 9.35523 18.6448 9.74458 18.8478 10.2346C19 10.6022 19 11.0681 19 12C19 12.9319 19 13.3978 18.8478 13.7654C18.6448 14.2554 18.2554 14.6448 17.7654 14.8478C17.3978 15 16.9319 15 16 15L8 15C7.06812 15 6.60218 15 6.23463 14.8478C5.74458 14.6448 5.35523 14.2554 5.15224 13.7654C5 13.3978 5 12.9319 5 12Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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