import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGuernsey icon widget (Guernsey.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGuernsey extends StatelessWidget {
  /// Creates a AqGuernsey icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGuernsey({
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
<g clip-path="url(#clip0_1692_53991)">
<path d="M2.02539 5.93896H21.9749V19.2386H2.02539V5.93896Z" fill="white"/>
<path d="M13.6626 5.93896V10.9263H21.9749V14.2513H13.6626V19.2386H10.3377V14.2513H2.02539V10.9263H10.3377V5.93896H13.6626Z" fill="#E8112D"/>
<path d="M7.00977 13.6968L7.56392 13.1426H11.443V17.0217L10.8888 17.5758H13.1055L12.5513 17.0217V13.1426H16.4304L16.9845 13.6968V11.4801L16.4304 12.0343H12.5513V8.15523L13.1055 7.60107H10.8888L11.443 8.15523V12.0343H7.56392L7.00977 11.4801V13.6968Z" fill="#F9DD16"/>
</g>
<defs>
<clipPath id="clip0_1692_53991">
<rect x="2.02539" y="5.93896" width="19.9495" height="13.2997" rx="1" fill="white"/>
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