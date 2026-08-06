import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqIceland icon widget (Iceland.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqIceland extends StatelessWidget {
  /// Creates a AqIceland icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqIceland({
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
<g clip-path="url(#clip0_1692_54156)">
<path d="M2.02539 5.76855H21.9749V19.0682H2.02539V5.76855Z" fill="#02529C"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M7.61126 11.3544V5.76855H10.8032V11.3544H21.9749V14.5463H10.8032V19.0682H7.61126V14.5463H2.02539V11.3544H7.61126Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M8.40924 12.1524V5.76855H10.0052V12.1524H21.9749V13.7484H10.0052V19.0682H8.40924V13.7484H2.02539V12.1524H8.40924Z" fill="#DC1E35"/>
</g>
<defs>
<clipPath id="clip0_1692_54156">
<rect x="2.02539" y="5.76855" width="19.9504" height="13.2997" rx="1" fill="white"/>
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