import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqScales02 icon widget (scales-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqScales02 extends StatelessWidget {
  /// Creates a AqScales02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqScales02({
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
<path d="M2.50145 13H8.50145M15.5015 13H21.5015M12.0015 7V21M12.0015 7C13.3822 7 14.5015 5.88071 14.5015 4.5M12.0015 7C10.6207 7 9.50145 5.88071 9.50145 4.5M4.00145 21L20.0015 21M4.00145 4.50001L9.50145 4.5M9.50145 4.5C9.50145 3.11929 10.6207 2 12.0015 2C13.3822 2 14.5015 3.11929 14.5015 4.5M14.5015 4.5L20.0015 4.5M8.88189 14.3364C8.4812 15.8706 7.11955 17 5.50145 17C3.88335 17 2.52171 15.8706 2.12101 14.3364C2.08827 14.211 2.0719 14.1483 2.07032 13.8979C2.06936 13.7443 2.12641 13.3904 2.17557 13.2449C2.25576 13.0076 2.34256 12.8737 2.51616 12.6059L5.50145 8L8.48674 12.6059C8.66034 12.8737 8.74715 13.0076 8.82734 13.2449C8.87649 13.3904 8.93355 13.7443 8.93258 13.8979C8.931 14.1483 8.91463 14.211 8.88189 14.3364ZM21.8819 14.3364C21.4812 15.8706 20.1196 17 18.5015 17C16.8833 17 15.5217 15.8706 15.121 14.3364C15.0883 14.211 15.0719 14.1483 15.0703 13.8979C15.0694 13.7443 15.1264 13.3904 15.1756 13.2449C15.2558 13.0076 15.3426 12.8737 15.5162 12.6059L18.5015 8L21.4867 12.6059C21.6603 12.8737 21.7471 13.0076 21.8273 13.2449C21.8765 13.3904 21.9335 13.7443 21.9326 13.8979C21.931 14.1483 21.9146 14.211 21.8819 14.3364Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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