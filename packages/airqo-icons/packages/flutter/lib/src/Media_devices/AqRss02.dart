import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRss02 icon widget (rss-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRss02 extends StatelessWidget {
  /// Creates a AqRss02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRss02({
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
<path d="M3.00024 13.0225C8.18522 12.2429 11.7559 15.8146 10.9774 20.9996M3.00024 8.03784C10.938 7.25824 16.7417 13.0619 15.9621 20.9997M3.00024 3.05212C13.6919 2.27364 21.7264 10.3082 20.948 20.9998M5 21C3.89566 21 3 20.1043 3 19C3 17.8957 3.89566 17 5 17C6.10434 17 7 17.8957 7 19C7 20.1043 6.10434 21 5 21Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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