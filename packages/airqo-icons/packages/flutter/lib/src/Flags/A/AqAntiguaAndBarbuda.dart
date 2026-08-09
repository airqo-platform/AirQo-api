import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqAntiguaAndBarbuda icon widget (Antigua-and-Barbuda.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqAntiguaAndBarbuda extends StatelessWidget {
  /// Creates a AqAntiguaAndBarbuda icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqAntiguaAndBarbuda({
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
        '''<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1692_54135)">
<path d="M2.11914 5.3501H22.0687V18.6498H2.11914V5.3501Z" fill="white"/>
<path d="M2.11914 5.3501H22.0687L20.7676 11.9999H3.4202L2.11914 5.3501Z" fill="black"/>
<path d="M12.1008 11.9993L7.76392 10.5536L9.97397 10.1307L8.09409 8.89393L10.2978 9.34887L9.03418 7.48706L10.896 8.75067L10.4411 6.54698L11.6778 8.42686L12.1008 6.2168L12.5238 8.42686L13.7605 6.54698L13.3055 8.75067L15.1674 7.48706L13.9037 9.34887L16.1074 8.89393L14.2276 10.1307L16.4376 10.5536L12.1008 11.9993Z" fill="#FCD116"/>
<path d="M3.41797 10.5542H20.7654V13.4454H3.41797V10.5542Z" fill="#0072C6"/>
<path d="M2.11914 5.3501L12.0939 18.6498L22.0687 5.3501V18.6498H2.11914V5.3501Z" fill="#CE1126"/>
</g>
<defs>
<clipPath id="clip0_1692_54135">
<rect x="2.11914" y="5.3501" width="19.9495" height="13.2997" rx="1" fill="white"/>
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