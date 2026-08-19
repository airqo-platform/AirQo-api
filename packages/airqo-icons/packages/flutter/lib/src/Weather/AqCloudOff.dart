import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCloudOff icon widget (cloud-off.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCloudOff extends StatelessWidget {
  /// Creates a AqCloudOff icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCloudOff({
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
<path d="M21.7003 16.1181C21.8939 15.616 22 15.0704 22 14.5C22 12.1564 20.2085 10.2313 17.9203 10.0194C17.4522 7.17213 14.9798 5 12 5C11.5534 5 11.1183 5.04879 10.6995 5.14132M7.28746 7.28585C6.67317 8.06419 6.24759 8.99838 6.07974 10.0194C3.79151 10.2313 2 12.1564 2 14.5C2 16.9853 4.01472 19 6.5 19H17.5C17.9561 19 18.3963 18.9322 18.8112 18.806M3 3L21 21" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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