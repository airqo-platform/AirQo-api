import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqBell03 icon widget (bell-03.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqBell03 extends StatelessWidget {
  /// Creates a AqBell03 icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqBell03({
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
<path d="M14.9987 19C14.9987 20.6569 13.6556 22 11.9987 22C10.3419 22 8.99874 20.6569 8.99874 19M13.7952 6.23856C14.2307 5.78864 14.4987 5.17562 14.4987 4.5C14.4987 3.11929 13.3795 2 11.9987 2C10.618 2 9.49874 3.11929 9.49874 4.5C9.49874 5.17562 9.76675 5.78864 10.2022 6.23856M17.9987 11.2C17.9987 9.82087 17.3666 8.49823 16.2414 7.52304C15.1162 6.54786 13.59 6 11.9987 6C10.4074 6 8.88132 6.54786 7.7561 7.52304C6.63089 8.49823 5.99874 9.82087 5.99874 11.2C5.99874 13.4818 5.43288 15.1506 4.72681 16.3447C3.92208 17.7056 3.51972 18.3861 3.53561 18.5486C3.55379 18.7346 3.58726 18.7933 3.73808 18.9036C3.86991 19 4.53225 19 5.85693 19H18.1406C19.4652 19 20.1276 19 20.2594 18.9036C20.4102 18.7933 20.4437 18.7346 20.4619 18.5486C20.4778 18.3861 20.0754 17.7056 19.2707 16.3447C18.5646 15.1506 17.9987 13.4818 17.9987 11.2Z" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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