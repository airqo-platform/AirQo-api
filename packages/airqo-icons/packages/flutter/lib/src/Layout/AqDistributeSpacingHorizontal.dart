import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDistributeSpacingHorizontal icon widget (distribute-spacing-horizontal.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDistributeSpacingHorizontal extends StatelessWidget {
  /// Creates a AqDistributeSpacingHorizontal icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDistributeSpacingHorizontal({
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
<path d="M21 21V3M3 21V3M9 8V16C9 16.9319 9 17.3978 9.15224 17.7654C9.35523 18.2554 9.74458 18.6448 10.2346 18.8478C10.6022 19 11.0681 19 12 19C12.9319 19 13.3978 19 13.7654 18.8478C14.2554 18.6448 14.6448 18.2554 14.8478 17.7654C15 17.3978 15 16.9319 15 16V8C15 7.06812 15 6.60218 14.8478 6.23463C14.6448 5.74458 14.2554 5.35523 13.7654 5.15224C13.3978 5 12.9319 5 12 5C11.0681 5 10.6022 5 10.2346 5.15224C9.74458 5.35523 9.35523 5.74458 9.15224 6.23463C9 6.60218 9 7.06812 9 8Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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