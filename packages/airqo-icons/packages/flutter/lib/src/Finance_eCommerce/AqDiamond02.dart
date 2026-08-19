import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqDiamond02 icon widget (diamond-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqDiamond02 extends StatelessWidget {
  /// Creates a AqDiamond02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqDiamond02({
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
<path d="M5.00131 22H19.0013M2.50131 8H21.5013M10.0013 2L8.00131 8L12.0013 18.5L16.0013 8L14.0013 2M12.5933 18.3489L21.5329 8.5153C21.6989 8.33264 21.7819 8.24131 21.815 8.13732C21.8442 8.04569 21.8463 7.94759 21.8211 7.85478C21.7925 7.74946 21.7135 7.65465 21.5555 7.46501L17.2412 2.28785C17.153 2.18204 17.1089 2.12914 17.0549 2.09111C17.007 2.05741 16.9536 2.03238 16.897 2.01717C16.8332 2 16.7643 2 16.6266 2H7.37601C7.23828 2 7.16941 2 7.1056 2.01717C7.04905 2.03238 6.99562 2.05741 6.94774 2.09111C6.89369 2.12914 6.84961 2.18204 6.76143 2.28785L2.44714 7.46501C2.28911 7.65464 2.21009 7.74946 2.18151 7.85478C2.15633 7.94759 2.15844 8.04569 2.1876 8.13732C2.22069 8.24131 2.30371 8.33264 2.46976 8.51529L11.4094 18.3489C11.6146 18.5746 11.7172 18.6875 11.8378 18.7292C11.9437 18.7659 12.0589 18.7659 12.1648 18.7292C12.2854 18.6875 12.388 18.5746 12.5933 18.3489Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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