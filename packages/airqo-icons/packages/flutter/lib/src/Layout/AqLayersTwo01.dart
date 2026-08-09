import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLayersTwo01 icon widget (layers-two-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLayersTwo01 extends StatelessWidget {
  /// Creates a AqLayersTwo01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLayersTwo01({
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
<path d="M2 14.4996L11.6422 19.3207C11.7734 19.3863 11.839 19.4191 11.9078 19.432C11.9687 19.4434 12.0313 19.4434 12.0922 19.432C12.161 19.4191 12.2266 19.3863 12.3578 19.3207L22 14.4996M2 9.49958L11.6422 4.67846C11.7734 4.61287 11.839 4.58008 11.9078 4.56717C11.9687 4.55574 12.0313 4.55574 12.0922 4.56717C12.161 4.58008 12.2266 4.61287 12.3578 4.67846L22 9.49958L12.3578 14.3207C12.2266 14.3863 12.161 14.4191 12.0922 14.432C12.0313 14.4434 11.9687 14.4434 11.9078 14.432C11.839 14.4191 11.7734 14.3863 11.6422 14.3207L2 9.49958Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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