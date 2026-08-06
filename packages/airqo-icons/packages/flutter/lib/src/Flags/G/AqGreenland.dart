import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGreenland icon widget (Greenland.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGreenland extends StatelessWidget {
  /// Creates a AqGreenland icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGreenland({
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
        '''<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54009)">
<path d="M21.973 5.93896H2.02344V19.2386H21.973V5.93896Z" fill="white"/>
<path d="M2.02344 12.589H21.973V19.2388H2.02344V12.589ZM5.34836 12.589C5.34836 13.7648 5.81543 14.8924 6.64682 15.7238C7.47821 16.5551 8.60582 17.0222 9.78158 17.0222C10.9573 17.0222 12.085 16.5551 12.9163 15.7238C13.7477 14.8924 14.2148 13.7648 14.2148 12.589C14.2148 11.4132 13.7477 10.2856 12.9163 9.45422C12.085 8.62283 10.9573 8.15576 9.78158 8.15576C8.60582 8.15576 7.47821 8.62283 6.64682 9.45422C5.81543 10.2856 5.34836 11.4132 5.34836 12.589Z" fill="#C8102E"/>
</g>
<defs>
<clipPath id="clip0_1692_54009">
<rect x="2.02344" y="5.93896" width="19.9495" height="13.2997" rx="1" fill="white"/>
</clipPath>
</defs>
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