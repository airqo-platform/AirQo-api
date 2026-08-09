import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// AqGitCommit icon widget (git-commit.svg)
/// 
/// A customizable SVG icon widget with configurable size and color.
class AqGitCommit extends StatelessWidget {
  /// Creates a AqGitCommit icon widget.
  /// 
  /// The [size] parameter controls both width and height of the icon.
  /// The [color] parameter overrides the default icon color.
  /// The [semanticsLabel] parameter provides accessibility support.
  const AqGitCommit({
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
<path d="M16 12C16 14.2091 14.2092 16 12 16C9.79091 16 8.00005 14.2091 8.00005 12M16 12C16 9.79086 14.2092 8 12 8C9.79091 8 8.00005 9.79086 8.00005 12M16 12H22M8.00005 12H2.00024" stroke="#1C1D20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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