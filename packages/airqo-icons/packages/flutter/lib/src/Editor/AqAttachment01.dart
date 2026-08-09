import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqAttachment01 icon widget (attachment-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqAttachment01 extends StatelessWidget {
  /// Creates a AqAttachment01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqAttachment01({
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
<path d="M21.1537 10.899L12.1381 19.9146C10.0878 21.9648 6.76372 21.9648 4.71347 19.9146C2.66322 17.8643 2.66322 14.5402 4.71347 12.49L13.7291 3.47435C15.0959 2.10751 17.312 2.10751 18.6788 3.47434C20.0457 4.84118 20.0457 7.05726 18.6788 8.42409L10.0168 17.0862C9.33335 17.7696 8.22531 17.7696 7.5419 17.0862C6.85848 16.4027 6.85848 15.2947 7.5419 14.6113L15.1433 7.00988" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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