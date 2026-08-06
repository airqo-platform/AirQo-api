import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqClockRefresh icon widget (clock-refresh.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqClockRefresh extends StatelessWidget {
  /// Creates a AqClockRefresh icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqClockRefresh({
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
<path d="M20.4523 12.8923C20.1745 15.5022 18.6957 17.948 16.2487 19.3607C12.1832 21.7079 6.98468 20.315 4.63747 16.2495L4.38747 15.8165M3.54519 11.1066C3.82299 8.49674 5.30178 6.05102 7.74877 4.63825C11.8143 2.29104 17.0128 3.68398 19.36 7.74947L19.61 8.18248M3.49219 18.0654L4.22424 15.3334L6.95629 16.0654M17.0412 7.93349L19.7733 8.66554L20.5053 5.93349M11.9988 7.49947V11.9995L14.4988 13.4995" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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