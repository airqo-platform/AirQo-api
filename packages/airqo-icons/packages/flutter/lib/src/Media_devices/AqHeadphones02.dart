import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqHeadphones02 icon widget (headphones-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqHeadphones02 extends StatelessWidget {
  /// Creates a AqHeadphones02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqHeadphones02({
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
<path d="M22 17V13C22 7.47715 17.5228 3 12 3C6.47715 3 2 7.47715 2 13V17M7.5 21C6.11929 21 5 19.8807 5 18.5V15.5C5 14.1193 6.11929 13 7.5 13C8.88071 13 10 14.1193 10 15.5V18.5C10 19.8807 8.88071 21 7.5 21ZM16.5 21C15.1193 21 14 19.8807 14 18.5V15.5C14 14.1193 15.1193 13 16.5 13C17.8807 13 19 14.1193 19 15.5V18.5C19 19.8807 17.8807 21 16.5 21Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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