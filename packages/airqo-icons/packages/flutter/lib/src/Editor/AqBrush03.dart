import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBrush03 icon widget (brush-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBrush03 extends StatelessWidget {
  /// Creates a AqBrush03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBrush03({
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
<path d="M20 10V3.6C20 3.03995 20 2.75992 19.891 2.54601C19.7951 2.35785 19.6422 2.20487 19.454 2.10899C19.2401 2 18.9601 2 18.4 2H5.6C5.03995 2 4.75992 2 4.54601 2.10899C4.35785 2.20487 4.20487 2.35785 4.10899 2.54601C4 2.75992 4 3.03995 4 3.6V10M20 10H4M20 10V10.2C20 11.8802 20 12.7202 19.673 13.362C19.3854 13.9265 18.9265 14.3854 18.362 14.673C17.7202 15 16.8802 15 15.2 15H8.8C7.11984 15 6.27976 15 5.63803 14.673C5.07354 14.3854 4.6146 13.9265 4.32698 13.362C4 12.7202 4 11.8802 4 10.2V10M14.5 15V19.5C14.5 20.8807 13.3807 22 12 22C10.6193 22 9.5 20.8807 9.5 19.5V15" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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