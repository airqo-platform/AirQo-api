import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMessagePlusCircle icon widget (message-plus-circle.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMessagePlusCircle extends StatelessWidget {
  /// Creates a AqMessagePlusCircle icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMessagePlusCircle({
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
<path d="M12.4986 14.5V8.5M9.49865 11.5H15.4986M12.4986 20C17.1931 20 20.9986 16.1944 20.9986 11.5C20.9986 6.80558 17.1931 3 12.4986 3C7.80423 3 3.99865 6.80558 3.99865 11.5C3.99865 12.45 4.1545 13.3636 4.44202 14.2166C4.55022 14.5376 4.60432 14.6981 4.61408 14.8214C4.62371 14.9432 4.61643 15.0286 4.5863 15.1469C4.5558 15.2668 4.48844 15.3915 4.35374 15.6408L2.71808 18.6684C2.48477 19.1002 2.36812 19.3161 2.39423 19.4828C2.41697 19.6279 2.5024 19.7557 2.62782 19.8322C2.77183 19.9201 3.01595 19.8948 3.50419 19.8444L8.62521 19.315C8.78029 19.299 8.85783 19.291 8.92851 19.2937C8.99802 19.2963 9.04709 19.3029 9.11488 19.3185C9.1838 19.3344 9.27047 19.3678 9.4438 19.4345C10.3919 19.7998 11.4219 20 12.4986 20Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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