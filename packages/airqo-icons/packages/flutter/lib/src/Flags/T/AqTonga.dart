import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqTonga icon widget (Tonga.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqTonga extends StatelessWidget {
  /// Creates a AqTonga icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqTonga({
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
<g clip-path="url(#clip0_1692_54029)">
<path d="M21.9983 5.55225H2.04883V18.8519H21.9983V5.55225Z" fill="#C10000"/>
<path d="M12.2102 5.55225H2.05069V11.6479H12.2102V5.55225Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M6.36975 6.31348H7.89389V7.83762H6.36975V6.31348ZM6.36975 9.36175V7.83762H4.84561V9.36175H6.36975ZM7.89389 9.36175V10.8859H6.36975V9.36175H7.89389ZM7.89389 9.36175H9.41803V7.83762H7.89389V9.36175Z" fill="#C10000"/>
<path d="M7.89389 7.83762H6.36975V9.36175H7.89389V7.83762Z" fill="#C10000"/>
</g>
<defs>
<clipPath id="clip0_1692_54029">
<rect x="2.04883" y="5.55225" width="19.9495" height="13.2997" rx="1" fill="white"/>
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