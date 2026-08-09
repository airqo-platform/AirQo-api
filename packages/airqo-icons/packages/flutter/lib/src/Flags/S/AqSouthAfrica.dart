import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqSouthAfrica icon widget (South-Africa.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqSouthAfrica extends StatelessWidget {
  /// Creates a AqSouthAfrica icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqSouthAfrica({
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
<g clip-path="url(#clip0_1692_54136)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9983 12.9812V6.33398H2.04883V12.9812H21.9983Z" fill="#CC2229"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9983 19.6249V12.9775H2.04883V19.6249H21.9983Z" fill="#1E71B8"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.9983 14.7716V11.1818L12.581 11.1847L5.91246 6.33398L2.04883 6.33433V19.6306L5.89077 19.6337L12.5719 14.7769L21.9983 14.7716Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M12.4375 14.3434L5.16564 19.6326L2.04894 19.6337L2.04883 6.33662L5.17529 6.33398L12.4447 11.622L21.9983 11.6236V14.3431L12.4375 14.3434Z" fill="#386F49"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.04883 17.7108L2.05203 8.25537L9.05268 12.9827L2.04883 17.7108Z" fill="#FFF22D"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M8.08338 12.975L2.04883 8.89648V17.0544L8.08338 12.975Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1692_54136">
<rect x="2.04688" y="6.33398" width="19.9534" height="13.3001" rx="1" fill="white"/>
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