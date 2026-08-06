import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRepeat02 icon widget (repeat-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRepeat02 extends StatelessWidget {
  /// Creates a AqRepeat02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRepeat02({
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
<path d="M11 2L14 5M14 5L11 8M14 5H6.8C5.11984 5 4.27976 5 3.63803 5.32698C3.07354 5.6146 2.6146 6.07354 2.32698 6.63803C2 7.27976 2 8.11984 2 9.8V15.5C2 15.9644 2 16.1966 2.02567 16.3916C2.2029 17.7378 3.26222 18.7971 4.60842 18.9743C4.80337 19 5.03558 19 5.5 19M10 19H17.2C18.8802 19 19.7202 19 20.362 18.673C20.9265 18.3854 21.3854 17.9265 21.673 17.362C22 16.7202 22 15.8802 22 14.2V8.5C22 8.03558 22 7.80337 21.9743 7.60842C21.7971 6.26222 20.7378 5.2029 19.3916 5.02567C19.1966 5 18.9644 5 18.5 5M10 19L13 22M10 19L13 16" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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