import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqNauru icon widget (Nauru.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqNauru extends StatelessWidget {
  /// Creates a AqNauru icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqNauru({
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
<g clip-path="url(#clip0_1692_54107)">
<path d="M21.9964 5.46338H2.04688V18.7631H21.9964V5.46338Z" fill="#002B7F"/>
<path d="M21.9964 11.6973H2.04688V12.5285H21.9964V11.6973Z" fill="#FFC61E"/>
<path d="M7.03574 15.8532L6.82057 14.9935L6.2044 15.6305L6.44789 14.7784L5.59581 15.0219L6.23272 14.4057L5.37305 14.1905L6.23272 13.9754L5.59581 13.3592L6.44789 13.6027L6.2044 12.7506L6.82057 13.3875L7.03574 12.5278L7.25091 13.3875L7.86709 12.7506L7.6236 13.6027L8.47568 13.3592L7.83876 13.9754L8.69844 14.1905L7.83876 14.4057L8.47568 15.0219L7.6236 14.7784L7.86709 15.6305L7.25091 14.9935L7.03574 15.8532Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54107">
<rect x="2.04688" y="5.46338" width="19.9495" height="13.2997" rx="1" fill="white"/>
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