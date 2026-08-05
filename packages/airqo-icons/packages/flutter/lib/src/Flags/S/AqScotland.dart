import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqScotland icon widget (Scotland.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqScotland extends StatelessWidget {
  /// Creates a AqScotland icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqScotland({
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
<g clip-path="url(#clip0_1692_54010)">
<mask id="mask0_1692_54010" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="2" y="6" width="20" height="14">
<path d="M21.9964 6.33447H2.04688V19.6341H21.9964V6.33447Z" fill="#005EB8"/>
</mask>
<g mask="url(#mask0_1692_54010)">
<path d="M21.9964 6.33447H2.04688V19.6341H21.9964V6.33447Z" fill="#005EB8"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M9.6255 13.034L0.890625 7.79287L2.19246 5.62305L12.0845 11.5585L21.9766 5.62305L23.2784 7.79287L14.5435 13.034L23.2784 18.2752L21.9766 20.445L12.0845 14.5095L2.19246 20.445L0.890625 18.2752L9.6255 13.034Z" fill="white"/>
</g>
</g>
<defs>
<clipPath id="clip0_1692_54010">
<rect x="2.04688" y="6.33447" width="19.9495" height="13.2997" rx="1" fill="white"/>
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