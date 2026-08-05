import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMusicNote02 icon widget (music-note-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMusicNote02 extends StatelessWidget {
  /// Creates a AqMusicNote02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMusicNote02({
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
<path d="M12 17.9991V5.58791C12 4.73069 12 4.30208 12.1805 4.04394C12.3382 3.81854 12.5817 3.66803 12.8538 3.62782C13.1655 3.58178 13.5488 3.77346 14.3155 4.15682L18 5.99905M12 17.9991C12 19.6559 10.6569 20.9991 9 20.9991C7.34315 20.9991 6 19.6559 6 17.9991C6 16.3422 7.34315 14.9991 9 14.9991C10.6569 14.9991 12 16.3422 12 17.9991Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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