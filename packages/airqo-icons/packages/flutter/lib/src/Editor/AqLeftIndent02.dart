import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqLeftIndent02 icon widget (left-indent-02.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqLeftIndent02 extends StatelessWidget {
  /// Creates a AqLeftIndent02 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqLeftIndent02({
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
<path d="M21 9.24995H12M21 3.99995L12 3.99995M21 14.75H3M21 20H3M4.28 2.95995L8.14667 5.85995C8.43616 6.07707 8.5809 6.18563 8.63266 6.31872C8.678 6.43529 8.678 6.56462 8.63266 6.68119C8.5809 6.81427 8.43616 6.92283 8.14667 7.13995L4.28 10.04C3.86802 10.3489 3.66203 10.5034 3.48961 10.4998C3.33956 10.4967 3.19885 10.4264 3.10632 10.3082C3 10.1724 3 9.91493 3 9.39995V3.59995C3 3.08498 3 2.82749 3.10632 2.6917C3.19885 2.57354 3.33956 2.50318 3.48961 2.50006C3.66203 2.49648 3.86802 2.65097 4.28 2.95995Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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