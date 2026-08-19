import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBeaker01 icon widget (beaker-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBeaker01 extends StatelessWidget {
  /// Creates a AqBeaker01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBeaker01({
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
<path d="M10 2.00008V6.6605C10 6.87768 10 6.98626 9.9669 7.07264C9.93568 7.15413 9.89435 7.21328 9.82858 7.27063C9.75885 7.33142 9.64593 7.37279 9.42008 7.45553C6.54892 8.50734 4.5 11.2644 4.5 14.5C4.5 18.6421 7.85786 22 12 22C16.1421 22 19.5 18.6421 19.5 14.5C19.5 11.2644 17.4511 8.50734 14.5799 7.45553C14.3541 7.37279 14.2411 7.33142 14.1714 7.27063C14.1056 7.21328 14.0643 7.15413 14.0331 7.07264C14 6.98626 14 6.87768 14 6.6605V2.00008M8.5 2H15.5" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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