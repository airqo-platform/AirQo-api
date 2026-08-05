import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBus icon widget (bus.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBus extends StatelessWidget {
  /// Creates a AqBus icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBus({
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
<path d="M8.5 19V21.2C8.5 21.48 8.5 21.62 8.4455 21.727C8.39757 21.8211 8.32108 21.8976 8.227 21.9455C8.12004 22 7.98003 22 7.7 22H5.8C5.51997 22 5.37996 22 5.273 21.9455C5.17892 21.8976 5.10243 21.8211 5.0545 21.727C5 21.62 5 21.48 5 21.2V19M19 19V21.2C19 21.48 19 21.62 18.9455 21.727C18.8976 21.8211 18.8211 21.8976 18.727 21.9455C18.62 22 18.48 22 18.2 22H16.3C16.02 22 15.88 22 15.773 21.9455C15.6789 21.8976 15.6024 21.8211 15.5545 21.727C15.5 21.62 15.5 21.48 15.5 21.2V19M3 12H21M3 5.5H21M6.5 15.5H8M16 15.5H17.5M7.8 19H16.2C17.8802 19 18.7202 19 19.362 18.673C19.9265 18.3854 20.3854 17.9265 20.673 17.362C21 16.7202 21 15.8802 21 14.2V6.8C21 5.11984 21 4.27976 20.673 3.63803C20.3854 3.07354 19.9265 2.6146 19.362 2.32698C18.7202 2 17.8802 2 16.2 2H7.8C6.11984 2 5.27976 2 4.63803 2.32698C4.07354 2.6146 3.6146 3.07354 3.32698 3.63803C3 4.27976 3 5.11984 3 6.8V14.2C3 15.8802 3 16.7202 3.32698 17.362C3.6146 17.9265 4.07354 18.3854 4.63803 18.673C5.27976 19 6.11984 19 7.8 19Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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