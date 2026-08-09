import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSomalia icon widget (Somalia.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSomalia extends StatelessWidget {
  /// Creates a AqSomalia icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSomalia({
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
<g clip-path="url(#clip0_1692_53984)">
<path d="M2.04883 6.33398H21.9983V19.6337H2.04883V6.33398Z" fill="#4189DD"/>
<path d="M12.0241 9.88086L12.721 12.0254L14.9759 12.0255L13.1517 13.3509L13.8484 15.4955L12.0241 14.1702L10.1998 15.4955L10.8965 13.3509L9.07233 12.0255L11.3272 12.0254L12.0241 9.88086Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_53984">
<rect x="2.04688" y="6.33398" width="19.9534" height="13.3001" rx="1" fill="white"/>
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