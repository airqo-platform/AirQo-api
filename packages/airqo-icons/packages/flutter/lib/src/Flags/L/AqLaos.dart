import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLaos icon widget (Laos.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLaos extends StatelessWidget {
  /// Creates a AqLaos icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLaos({
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
<g clip-path="url(#clip0_1692_54076)">
<path d="M2.04883 6.02783H21.9983V19.3275H2.04883V6.02783Z" fill="#CE1126"/>
<path d="M2.04883 9.35254H21.9983V16.0024H2.04883V9.35254Z" fill="#002868"/>
<path d="M12.0275 15.3392C13.4968 15.3392 14.6878 14.1481 14.6878 12.6789C14.6878 11.2096 13.4968 10.0186 12.0275 10.0186C10.5583 10.0186 9.36719 11.2096 9.36719 12.6789C9.36719 14.1481 10.5583 15.3392 12.0275 15.3392Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54076">
<rect x="2.04883" y="6.02783" width="19.9504" height="13.2997" rx="1" fill="white"/>
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