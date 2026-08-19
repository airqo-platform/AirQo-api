import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqNavigationPointer02 icon widget (navigation-pointer-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqNavigationPointer02 extends StatelessWidget {
  /// Creates a AqNavigationPointer02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqNavigationPointer02({
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
<path d="M5.03685 21.3248C4.45216 21.5821 4.15982 21.7107 3.98042 21.6542C3.8249 21.6052 3.70303 21.4835 3.65387 21.328C3.59717 21.1487 3.72545 20.8562 3.98203 20.2712L11.2634 3.66971C11.495 3.14163 11.6108 2.8776 11.7727 2.79678C11.9133 2.72659 12.0787 2.72659 12.2193 2.79678C12.3812 2.8776 12.497 3.14163 12.7287 3.66971L20.01 20.2712C20.2666 20.8562 20.3949 21.1487 20.3382 21.328C20.289 21.4835 20.1671 21.6052 20.0116 21.6542C19.8322 21.7107 19.5399 21.5821 18.9552 21.3248L12.3182 18.4045C12.1995 18.3523 12.1402 18.3262 12.0785 18.3159C12.0239 18.3067 11.9681 18.3067 11.9135 18.3159C11.8519 18.3262 11.7925 18.3523 11.6738 18.4045L5.03685 21.3248Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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