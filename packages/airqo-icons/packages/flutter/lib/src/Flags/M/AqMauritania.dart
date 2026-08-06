import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMauritania icon widget (Mauritania.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMauritania extends StatelessWidget {
  /// Creates a AqMauritania icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMauritania({
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
<g clip-path="url(#clip0_1692_54133)">
<path d="M2.04883 6.24561H21.9983V19.5453H2.04883V6.24561Z" fill="#D01C1F"/>
<path d="M2.04883 8.90527H21.9983V16.8851H2.04883V8.90527Z" fill="#00A95C"/>
<path d="M10.684 11.1939H11.7014L12.0206 10.2363L12.3398 11.1939H13.3572L12.5193 11.8057L12.8585 12.7766L12.0206 12.1781L11.1827 12.7766L11.5218 11.8057L10.684 11.1939ZM7.0332 10.7018C7.22782 11.6787 7.83613 12.5666 8.74962 13.2073C9.66311 13.8479 10.8224 14.1996 12.0206 14.1996C13.2188 14.1996 14.3781 13.8479 15.2915 13.2073C16.205 12.5666 16.8133 11.6787 17.008 10.7018C17.008 11.9893 16.4825 13.224 15.5472 14.1344C14.6119 15.0448 13.3433 15.5562 12.0206 15.5562C10.6978 15.5562 9.42929 15.0448 8.49397 14.1344C7.55866 13.224 7.0332 11.9893 7.0332 10.7018Z" fill="#FFD700"/>
</g>
<defs>
<clipPath id="clip0_1692_54133">
<rect x="2.04883" y="6.24561" width="19.9495" height="13.2997" rx="1" fill="white"/>
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