import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqEastTimor icon widget (East-Timor.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqEastTimor extends StatelessWidget {
  /// Creates a AqEastTimor icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqEastTimor({
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
<g clip-path="url(#clip0_1692_54163)">
<path d="M2.02148 5.56836H21.971V18.868H2.02148V5.56836Z" fill="#DA291C"/>
<path d="M15.3212 12.2182L2.02148 18.868V5.56836L15.3212 12.2182Z" fill="#FFC72C"/>
<path d="M10.8879 12.2182L2.02148 18.868V5.56836L10.8879 12.2182Z" fill="black"/>
<path d="M4.08193 10.1909L6.9015 13.3265L2.77734 12.447L6.63074 10.7344L4.51992 14.3849L4.08193 10.1909Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54163">
<rect x="2.02539" y="5.50342" width="19.9504" height="13.2997" rx="1" fill="white"/>
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