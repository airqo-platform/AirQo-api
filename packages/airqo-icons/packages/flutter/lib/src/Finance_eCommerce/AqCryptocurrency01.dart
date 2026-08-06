import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCryptocurrency01 icon widget (cryptocurrency-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCryptocurrency01 extends StatelessWidget {
  /// Creates a AqCryptocurrency01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCryptocurrency01({
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
<path d="M17.8778 20.0902C16.1694 21.3315 14.1118 22 12 22C9.88821 22 7.83062 21.3315 6.12215 20.0902M16.3837 3.01206C18.2818 3.93781 19.838 5.44068 20.8295 7.30528C21.8209 9.16989 22.1966 11.3005 21.9027 13.3917M2.09741 13.3916C1.80351 11.3004 2.17919 9.16979 3.17062 7.30519C4.16205 5.44059 5.71832 3.93771 7.61638 3.01196M17.5 12C17.5 15.0376 15.0376 17.5 12 17.5C8.96243 17.5 6.5 15.0376 6.5 12C6.5 8.96244 8.96243 6.5 12 6.5C15.0376 6.5 17.5 8.96244 17.5 12Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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