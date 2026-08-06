import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSingapore icon widget (Singapore.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSingapore extends StatelessWidget {
  /// Creates a AqSingapore icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSingapore({
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
<g clip-path="url(#clip0_1692_54037)">
<path d="M2.04883 6.33447H21.9983V19.6341H2.04883V6.33447Z" fill="white"/>
<path d="M2.04883 6.33447H21.9983V12.9843H2.04883V6.33447Z" fill="#ED2939"/>
<path d="M6.81459 12.0456C6.63651 12.0868 6.45098 12.1086 6.26036 12.1086C4.90844 12.1086 3.8125 11.0127 3.8125 9.66075C3.8125 8.30883 4.90844 7.21289 6.26036 7.21289C6.45098 7.21289 6.63651 7.23468 6.81459 7.2759C5.72964 7.52703 4.92096 8.49945 4.92096 9.66075C4.92096 10.822 5.72964 11.7945 6.81459 12.0456Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M7.45665 8.05974L7.59975 7.61933L7.74284 8.05974H7.45665ZM7.36821 8.33193L6.99357 8.05974H7.45665L7.36821 8.33193ZM7.59975 8.50015L7.36821 8.33193L7.22511 8.77234L7.59975 8.50015ZM7.59975 8.50015L7.97438 8.77234L7.83128 8.33193L8.20592 8.05974H7.74284L7.83128 8.33193L7.59975 8.50015Z" fill="white"/>
<path d="M7.74284 8.05974H7.45665L7.36821 8.33193L7.59975 8.50015L7.83128 8.33193L7.74284 8.05974Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1692_54037">
<rect x="2.04883" y="6.33447" width="19.9495" height="13.2997" rx="1" fill="white"/>
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