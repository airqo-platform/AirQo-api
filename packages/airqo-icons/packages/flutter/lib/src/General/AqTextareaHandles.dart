import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqTextareaHandles icon widget (textarea-handles.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqTextareaHandles extends StatelessWidget {
  /// Creates a AqTextareaHandles icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqTextareaHandles({
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
<path d="M20 15.6118L15.6118 20M19.2879 9.50073L9.50027 19.2884" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round"/>
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