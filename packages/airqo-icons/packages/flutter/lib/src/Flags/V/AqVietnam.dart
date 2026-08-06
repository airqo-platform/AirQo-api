import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqVietnam icon widget (Vietnam.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqVietnam extends StatelessWidget {
  /// Creates a AqVietnam icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqVietnam({
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
<g clip-path="url(#clip0_1692_54141)">
<path d="M21.9983 5.98779H2.04883V19.2875H21.9983V5.98779Z" fill="#DA251D"/>
<path d="M12.0215 8.64746L9.67415 15.8625L15.8186 11.4071H8.22449L14.3689 15.8625L12.0215 8.64746Z" fill="#FFFF00"/>
</g>
<defs>
<clipPath id="clip0_1692_54141">
<rect x="2.04883" y="5.98779" width="19.9495" height="13.2997" rx="1" fill="white"/>
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