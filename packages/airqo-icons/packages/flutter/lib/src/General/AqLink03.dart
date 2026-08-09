import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLink03 icon widget (link-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLink03 extends StatelessWidget {
  /// Creates a AqLink03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLink03({
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
<path d="M9.99825 13C10.4277 13.5741 10.9756 14.0491 11.6048 14.3929C12.234 14.7367 12.9298 14.9411 13.6449 14.9923C14.36 15.0435 15.0778 14.9403 15.7496 14.6897C16.4214 14.4392 17.0314 14.047 17.5382 13.54L20.5382 10.54C21.449 9.59695 21.953 8.33394 21.9416 7.02296C21.9302 5.71198 21.4044 4.45791 20.4773 3.53087C19.5503 2.60383 18.2962 2.07799 16.9853 2.0666C15.6743 2.0552 14.4113 2.55918 13.4682 3.46997L11.7482 5.17997M13.9982 11C13.5688 10.4258 13.0209 9.95078 12.3917 9.60703C11.7625 9.26327 11.0667 9.05885 10.3516 9.00763C9.63645 8.95641 8.91866 9.0596 8.2469 9.31018C7.57514 9.56077 6.96513 9.9529 6.45825 10.46L3.45825 13.46C2.54746 14.403 2.04348 15.666 2.05488 16.977C2.06627 18.288 2.59211 19.542 3.51915 20.4691C4.44619 21.3961 5.70026 21.9219 7.01124 21.9333C8.32222 21.9447 9.58524 21.4408 10.5282 20.53L12.2382 18.82" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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