import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqRefreshCw05 icon widget (refresh-cw-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqRefreshCw05 extends StatelessWidget {
  /// Creates a AqRefreshCw05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqRefreshCw05({
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
<path d="M20.452 12.8927C20.1742 15.5026 18.6954 17.9483 16.2484 19.3611C12.1829 21.7083 6.98442 20.3153 4.63721 16.2499L4.38721 15.8168M3.54515 11.1066C3.82295 8.49674 5.30174 6.05102 7.74873 4.63825C11.8142 2.29104 17.0127 3.68398 19.3599 7.74947L19.6099 8.18248M3.49219 18.0657L4.22424 15.3336L6.95629 16.0657M17.0414 7.93364L19.7735 8.66569L20.5055 5.93364" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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