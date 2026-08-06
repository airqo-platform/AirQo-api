import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqContrast01 icon widget (contrast-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqContrast01 extends StatelessWidget {
  /// Creates a AqContrast01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqContrast01({
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
<path d="M12 2C12.5917 2 13.1713 2.05139 13.7348 2.14994M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22M12 2V22M17.738 3.809C18.6922 4.47869 19.5241 5.31089 20.1934 6.26541M21.8501 10.2656C21.9486 10.8289 22 11.4085 22 12C22 12.5915 21.9486 13.1711 21.8501 13.7344M20.1892 17.7406C19.5203 18.693 18.6896 19.5233 17.7369 20.1917M13.7328 21.8504C13.17 21.9487 12.591 22 12 22" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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