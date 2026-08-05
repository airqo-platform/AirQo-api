import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGlasses02 icon widget (glasses-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGlasses02 extends StatelessWidget {
  /// Creates a AqGlasses02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGlasses02({
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
<path d="M10 14.5347C11.2335 13.8218 12.7663 13.8218 13.9999 14.5347M2 15L2.70149 7.98511C2.72808 7.71915 2.74138 7.58617 2.76178 7.47208C3.00222 6.12702 4.1212 5.11436 5.48352 5.00894C5.59907 5 5.73271 5 6 5M22 15L21.2985 7.98511C21.2719 7.71916 21.2586 7.58617 21.2382 7.47208C20.9978 6.12702 19.8788 5.11436 18.5165 5.00894C18.4009 5 18.2673 5 18 5M8.82843 12.1716C10.3905 13.7337 10.3905 16.2663 8.82843 17.8284C7.26634 19.3905 4.73367 19.3905 3.17157 17.8284C1.60948 16.2663 1.60948 13.7337 3.17157 12.1716C4.73366 10.6095 7.26633 10.6095 8.82843 12.1716ZM20.8284 12.1716C22.3905 13.7337 22.3905 16.2663 20.8284 17.8284C19.2663 19.3905 16.7337 19.3905 15.1716 17.8284C13.6095 16.2663 13.6095 13.7337 15.1716 12.1716C16.7337 10.6095 19.2663 10.6095 20.8284 12.1716Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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