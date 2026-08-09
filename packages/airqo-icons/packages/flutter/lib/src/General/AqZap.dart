import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqZap icon widget (zap.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqZap extends StatelessWidget {
  /// Creates a AqZap icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqZap({
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
<path d="M12.9989 2L4.09234 12.6879C3.74353 13.1064 3.56913 13.3157 3.56646 13.4925C3.56415 13.6461 3.63262 13.7923 3.75214 13.8889C3.88963 14 4.16206 14 4.70692 14H11.9989L10.9989 22L19.9054 11.3121C20.2542 10.8936 20.4286 10.6843 20.4313 10.5075C20.4336 10.3539 20.3652 10.2077 20.2456 10.1111C20.1081 10 19.8357 10 19.2909 10H11.9989L12.9989 2Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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