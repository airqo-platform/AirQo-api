import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqJapan icon widget (Japan.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqJapan extends StatelessWidget {
  /// Creates a AqJapan icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqJapan({
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
<g clip-path="url(#clip0_1692_54096)">
<path d="M21.9964 5.59229H2.04688V18.892H21.9964V5.59229Z" fill="white"/>
<path d="M12.0291 16.2318C14.2326 16.2318 16.019 14.4454 16.019 12.2419C16.019 10.0383 14.2326 8.25195 12.0291 8.25195C9.82552 8.25195 8.03918 10.0383 8.03918 12.2419C8.03918 14.4454 9.82552 16.2318 12.0291 16.2318Z" fill="#BC002D"/>
</g>
<defs>
<clipPath id="clip0_1692_54096">
<rect x="2.04688" y="5.59229" width="19.9495" height="13.2997" rx="1" fill="white"/>
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