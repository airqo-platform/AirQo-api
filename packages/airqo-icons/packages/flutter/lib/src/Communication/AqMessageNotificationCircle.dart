import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqMessageNotificationCircle icon widget (message-notification-circle.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqMessageNotificationCircle extends StatelessWidget {
  /// Creates a AqMessageNotificationCircle icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqMessageNotificationCircle({
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
<path d="M11.706 3.03647C7.38323 3.43621 3.99865 7.07285 3.99865 11.5C3.99865 12.45 4.1545 13.3636 4.44202 14.2166C4.55022 14.5376 4.60432 14.6981 4.61408 14.8214C4.62371 14.9432 4.61643 15.0286 4.5863 15.1469C4.5558 15.2668 4.48844 15.3915 4.35374 15.6408L2.71808 18.6684C2.48477 19.1002 2.36812 19.3161 2.39423 19.4828C2.41697 19.6279 2.5024 19.7557 2.62782 19.8322C2.77183 19.9201 3.01595 19.8948 3.50419 19.8444L8.62521 19.315C8.78023 19.299 8.85785 19.291 8.92851 19.2937C8.99802 19.2963 9.04709 19.3029 9.11488 19.3185C9.1838 19.3344 9.27047 19.3678 9.4438 19.4345C10.3919 19.7998 11.4219 20 12.4986 20C16.9294 20 20.5684 16.6098 20.9632 12.2819M20.12 3.87868C21.2915 5.05025 21.2915 6.94975 20.12 8.12132C18.9484 9.29289 17.0489 9.29289 15.8773 8.12132C14.7058 6.94975 14.7058 5.05025 15.8773 3.87868C17.0489 2.70711 18.9484 2.70711 20.12 3.87868Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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