import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqAtom01 icon widget (atom-01.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqAtom01 extends StatelessWidget {
  /// Creates a AqAtom01 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqAtom01({
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
<path d="M11.9995 11.9997H12.0095M15.535 15.5352C10.8488 20.2215 5.46685 22.4376 3.51423 20.4849C1.56161 18.5323 3.77769 13.1504 8.46398 8.46412C13.1503 3.77783 18.5322 1.56175 20.4848 3.51437C22.4374 5.46699 20.2213 10.8489 15.535 15.5352ZM15.535 8.46394C20.2213 13.1502 22.4374 18.5321 20.4848 20.4848C18.5321 22.4374 13.1502 20.2213 8.46394 15.535C3.77765 10.8487 1.56157 5.46681 3.51419 3.51419C5.46681 1.56157 10.8487 3.77765 15.535 8.46394ZM12.4995 11.9997C12.4995 12.2758 12.2757 12.4997 11.9995 12.4997C11.7234 12.4997 11.4995 12.2758 11.4995 11.9997C11.4995 11.7235 11.7234 11.4997 11.9995 11.4997C12.2757 11.4997 12.4995 11.7235 12.4995 11.9997Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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