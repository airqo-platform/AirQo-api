import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSaba icon widget (Saba.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSaba extends StatelessWidget {
  /// Creates a AqSaba icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSaba({
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
<g clip-path="url(#clip0_1692_54150)">
<path d="M21.9983 19.6337H2.04883V6.33398H21.9983V19.6337Z" fill="#DC171D"/>
<path d="M21.9983 19.6347H2.04883V12.9849H21.9983V19.6347Z" fill="#012A87"/>
<path d="M12.0236 19.6337L2.04883 12.9838L12.0236 6.33398L21.9983 12.9838L12.0236 19.6337Z" fill="white"/>
<path d="M12.0191 8.99414L12.9149 11.7511H15.8137L13.4685 13.455L14.3643 16.2119L12.0191 14.5081L9.6739 16.2119L10.5697 13.455L8.22449 11.7511H11.1233L12.0191 8.99414Z" fill="#F9D90F"/>
</g>
<defs>
<clipPath id="clip0_1692_54150">
<rect x="2.04883" y="6.33447" width="19.9504" height="13.2997" rx="1" fill="white"/>
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