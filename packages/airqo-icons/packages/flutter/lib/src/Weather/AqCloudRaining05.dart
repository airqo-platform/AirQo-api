import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloudRaining05 icon widget (cloud-raining-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloudRaining05 extends StatelessWidget {
  /// Creates a AqCloudRaining05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloudRaining05({
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
<path d="M16 19L15 21.5M8 19L7 21.5M12 19L11 21.5M7 15.5C4.23858 15.5 2 13.2614 2 10.5C2 7.73858 4.23858 5.5 7 5.5C7.03315 5.5 7.06622 5.50032 7.09922 5.50097C8.0094 3.7196 9.86227 2.5 12 2.5C14.5192 2.5 16.6429 4.19375 17.2943 6.50462C17.3625 6.50155 17.4311 6.5 17.5 6.5C19.9853 6.5 22 8.51472 22 11C22 13.4853 19.9853 15.5 17.5 15.5C13.7434 15.5 11.2352 15.5 7 15.5Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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