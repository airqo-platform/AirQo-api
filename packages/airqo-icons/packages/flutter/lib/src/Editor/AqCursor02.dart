import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCursor02 icon widget (cursor-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCursor02 extends StatelessWidget {
  /// Creates a AqCursor02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCursor02({
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
<path d="M20.5064 10.7763C21.1233 10.5364 21.4317 10.4165 21.5183 10.2469C21.5934 10.0999 21.5911 9.92543 21.5122 9.78051C21.4212 9.61324 21.1097 9.50142 20.4867 9.27778L4.59702 3.57378C4.08733 3.39081 3.83248 3.29933 3.66587 3.35702C3.52102 3.40718 3.40719 3.52102 3.35702 3.66587C3.29933 3.83248 3.39081 4.08733 3.57378 4.59702L9.27773 20.4867C9.50137 21.1097 9.61319 21.4212 9.78046 21.5123C9.92539 21.5911 10.0999 21.5934 10.2468 21.5184C10.4164 21.4318 10.5364 21.1233 10.7763 20.5064L13.3731 13.8288C13.4201 13.708 13.4436 13.6476 13.4799 13.5967C13.5121 13.5516 13.5515 13.5121 13.5966 13.48C13.6475 13.4437 13.7079 13.4202 13.8288 13.3732L20.5064 10.7763Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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