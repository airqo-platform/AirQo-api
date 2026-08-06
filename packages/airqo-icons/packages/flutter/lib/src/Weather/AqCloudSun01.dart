import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloudSun01 icon widget (cloud-sun-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloudSun01 extends StatelessWidget {
  /// Creates a AqCloudSun01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloudSun01({
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
<path d="M19.368 12.4048C20.935 11.5606 22 9.9047 22 8C22 5.23858 19.7614 3 17 3C14.2386 3 12 5.23858 12 8M12 8C9.86227 8 8.0094 9.2196 7.09922 11.001C7.06622 11.0003 7.03315 11 7 11C4.23858 11 2 13.2386 2 16C2 18.7614 4.23858 21 7 21C11.2352 21 13.7434 21 17.5 21C19.9853 21 22 18.9853 22 16.5C22 14.0147 19.9853 12 17.5 12C17.4311 12 17.3625 12.0016 17.2943 12.0046C16.6429 9.69375 14.5192 8 12 8Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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