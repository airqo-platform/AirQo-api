import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCzechRepublic icon widget (Czech-Republic.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCzechRepublic extends StatelessWidget {
  /// Creates a AqCzechRepublic icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCzechRepublic({
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
        '''<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54085)">
<path d="M22.6565 6.06738H2.70703V19.3671H22.6565V6.06738Z" fill="#D7141A"/>
<path d="M22.6565 6.06738H2.70703V12.7172H22.6565V6.06738Z" fill="white"/>
<path d="M12.6818 12.7172L2.70703 6.06738V19.3671L12.6818 12.7172Z" fill="#11457E"/>
</g>
<defs>
<clipPath id="clip0_1692_54085">
<rect x="2.69922" y="6.06738" width="19.9534" height="13.3001" rx="1" fill="white"/>
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