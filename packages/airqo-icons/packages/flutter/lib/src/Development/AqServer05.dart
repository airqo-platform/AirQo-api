import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqServer05 icon widget (server-05.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqServer05 extends StatelessWidget {
  /// Creates a AqServer05 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqServer05({
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
<path d="M19 9C19 12.866 15.866 16 12 16M19 9C19 5.13401 15.866 2 12 2M19 9H5M12 16C8.13401 16 5 12.866 5 9M12 16C13.7509 14.0832 14.7468 11.5956 14.8009 9C14.7468 6.40442 13.7509 3.91685 12 2M12 16C10.2491 14.0832 9.25498 11.5956 9.20091 9C9.25498 6.40442 10.2491 3.91685 12 2M12 16V18M5 9C5 5.13401 8.13401 2 12 2M14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20M14 20C14 18.8954 13.1046 18 12 18M14 20H21M10 20C10 18.8954 10.8954 18 12 18M10 20H3" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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