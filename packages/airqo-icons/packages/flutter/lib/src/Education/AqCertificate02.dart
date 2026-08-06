import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqCertificate02 icon widget (certificate-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqCertificate02 extends StatelessWidget {
  /// Creates a AqCertificate02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqCertificate02({
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
<path d="M9 18.5H15M7 15H17M5 2H19C20.1046 2 21 2.99492 21 4.22222V19.7778C21 21.0051 20.1046 22 19 22H5C3.89543 22 3 21.0051 3 19.7778V4.22222C3 2.99492 3.89543 2 5 2ZM11.9976 6.21194C11.2978 5.4328 10.1309 5.22321 9.25414 5.93667C8.37738 6.65013 8.25394 7.84299 8.94247 8.6868C9.631 9.53061 11.9976 11.5 11.9976 11.5C11.9976 11.5 14.3642 9.53061 15.0527 8.6868C15.7413 7.84299 15.6329 6.64262 14.7411 5.93667C13.8492 5.23072 12.6974 5.4328 11.9976 6.21194Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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