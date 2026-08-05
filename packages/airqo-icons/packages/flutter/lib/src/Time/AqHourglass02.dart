import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqHourglass02 icon widget (hourglass-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqHourglass02 extends StatelessWidget {
  /// Creates a AqHourglass02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqHourglass02({
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
<path d="M18.1626 2H5.83744C5.37494 2 5 2.37494 5 2.83744C5 5.50268 6.05876 8.05876 7.94337 9.94337L9.16256 11.1626C9.28363 11.2836 9.34417 11.3442 9.3875 11.4023C9.65188 11.7569 9.65188 12.2431 9.3875 12.5977C9.34417 12.6558 9.28363 12.7164 9.16256 12.8374L7.94337 14.0566C6.05876 15.9412 5 18.4973 5 21.1626C5 21.6251 5.37494 22 5.83744 22H18.1626C18.6251 22 19 21.6251 19 21.1626C19 18.4973 17.9412 15.9412 16.0566 14.0566L14.8374 12.8374C14.7164 12.7164 14.6558 12.6558 14.6125 12.5977C14.3481 12.2431 14.3481 11.7569 14.6125 11.4023C14.6558 11.3442 14.7164 11.2836 14.8374 11.1626L16.0566 9.94337C17.9412 8.05876 19 5.50268 19 2.83744C19 2.37494 18.6251 2 18.1626 2Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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