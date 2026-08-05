import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMinimize02 icon widget (minimize-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMinimize02 extends StatelessWidget {
  /// Creates a AqMinimize02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMinimize02({
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
<path d="M2.99988 7.99988H3.19988C4.88004 7.99988 5.72011 7.99988 6.36185 7.6729C6.92634 7.38528 7.38528 6.92634 7.6729 6.36185C7.99988 5.72011 7.99988 4.88004 7.99988 3.19988V2.99988M2.99988 15.9999H3.19988C4.88004 15.9999 5.72011 15.9999 6.36185 16.3269C6.92634 16.6145 7.38528 17.0734 7.6729 17.6379C7.99988 18.2796 7.99988 19.1197 7.99988 20.7999V20.9999M15.9999 2.99988V3.19988C15.9999 4.88004 15.9999 5.72011 16.3269 6.36185C16.6145 6.92634 17.0734 7.38528 17.6379 7.6729C18.2796 7.99988 19.1197 7.99988 20.7999 7.99988H20.9999M15.9999 20.9999V20.7999C15.9999 19.1197 15.9999 18.2796 16.3269 17.6379C16.6145 17.0734 17.0734 16.6145 17.6379 16.3269C18.2796 15.9999 19.1197 15.9999 20.7999 15.9999H20.9999" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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