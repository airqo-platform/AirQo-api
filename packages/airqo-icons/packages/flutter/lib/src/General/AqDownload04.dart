import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDownload04 icon widget (download-04.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDownload04 extends StatelessWidget {
  /// Creates a AqDownload04 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDownload04({
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
<path d="M8 11.9999L12 15.9999M12 15.9999L16 11.9999M12 15.9999V6.79994C12 5.40923 12 4.71388 11.4495 3.93534C11.0837 3.41806 10.0306 2.77962 9.40278 2.69456C8.45789 2.56654 8.09907 2.75372 7.38143 3.12808C4.18333 4.79637 2 8.14318 2 11.9999C2 17.5228 6.47715 21.9999 12 21.9999C17.5228 21.9999 22 17.5228 22 11.9999C22 8.29853 19.989 5.06681 17 3.33776" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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