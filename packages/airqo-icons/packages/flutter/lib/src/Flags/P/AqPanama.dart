import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqPanama icon widget (Panama.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqPanama extends StatelessWidget {
  /// Creates a AqPanama icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqPanama({
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
<g clip-path="url(#clip0_1692_54046)">
<path d="M2.04688 12.331V5.68115H12.0216L21.9964 12.331V18.9808H12.0216L2.04688 12.331Z" fill="white"/>
<path d="M12.0273 5.68115H22.0021V12.331H12.0273V5.68115ZM17.0147 13.9935L18.095 17.3184L15.2666 15.2634H18.7628L15.9345 17.3184L17.0147 13.9935Z" fill="#DA121A"/>
<path d="M2.04688 12.3297H12.0216V18.9795H2.04688V12.3297ZM7.03425 7.34229L8.11452 10.6672L5.28618 8.61224H8.78233L5.95399 10.6672L7.03425 7.34229Z" fill="#072357"/>
</g>
<defs>
<clipPath id="clip0_1692_54046">
<rect x="2.04688" y="5.68115" width="19.9551" height="13.2998" rx="1" fill="white"/>
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