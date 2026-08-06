import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqUserRight01 icon widget (user-right-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqUserRight01 extends StatelessWidget {
  /// Creates a AqUserRight01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqUserRight01({
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
        '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1541_52011)">
<path d="M19 24L22 21M22 21L19 18M22 21H16M12 18.5H7.5C6.10444 18.5 5.40665 18.5 4.83886 18.6722C3.56045 19.06 2.56004 20.0605 2.17224 21.3389C2 21.9067 2 22.6044 2 24M14.5 10.5C14.5 12.9853 12.4853 15 10 15C7.51472 15 5.5 12.9853 5.5 10.5C5.5 8.01472 7.51472 6 10 6C12.4853 6 14.5 8.01472 14.5 10.5Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1541_52011">
<rect width="24" height="24" fill="white"/>
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