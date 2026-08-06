import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloudMoon icon widget (cloud-moon.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloudMoon extends StatelessWidget {
  /// Creates a AqCloudMoon icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloudMoon({
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
<path d="M16.5 13.0005C19.0768 13.0005 21.2397 11.2285 21.8366 8.83653C21.4087 8.94336 20.961 9.00007 20.5 9.00007C17.4624 9.00007 15 6.53763 15 3.50007C15 3.0393 15.0567 2.59177 15.1634 2.16406C12.7717 2.76117 11 4.92394 11 7.50052C11 8.41324 11.2223 9.27403 11.6158 10.0317M5 7.00049V3.00049M3 5.00049H7M6 22.0005C3.79086 22.0005 2 20.2096 2 18.0005C2 16.0226 3.43551 14.3801 5.32148 14.0578C6.12876 11.6975 8.3662 10.0005 11 10.0005C13.2882 10.0005 15.2772 11.2814 16.2892 13.1653C16.6744 13.0579 17.0805 13.0005 17.5 13.0005C19.9853 13.0005 22 15.0152 22 17.5005C22 19.9858 19.9853 22.0005 17.5 22.0005C13.6667 22.0005 9.83333 22.0005 6 22.0005Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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