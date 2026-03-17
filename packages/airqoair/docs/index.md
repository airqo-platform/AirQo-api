# Preface

![airqoair hero](assets/images/airqoair-hero.svg){ width="280" align=right }

Welcome to the airqoair book.

This documentation site is intended to be the long-form reference for the `airqoair` Python package: what it does, how to use it, and how to build reproducible air-quality analysis workflows around it.

The site is structured as a book rather than a flat API reference because most users do not approach air-quality analysis as isolated functions. They move through recurring tasks:

- load and validate time-stamped observations
- compare pollution by time of day, day of week, month, season, or site
- examine wind-direction effects with roses and polar plots
- assess trends using diagnostics such as calendar plots, time proportion plots, and Theil-Sen estimators
- publish interactive maps and share outputs with others

## How To Read This Book

You do not need to read the chapters in order, but the documentation is organised that way intentionally:

- Chapter 1 explains installation, expected inputs, and the general design of the package
- Chapter 2 focuses on directional analysis
- Chapter 3 covers time-series diagnostics and trend methods
- Chapter 4 collects the interactive mapping workflows
- Chapter 5 covers model-evaluation tools
- The appendix is a compact API reference

## What This Site Covers

- A guided introduction to the package and expected data formats
- Sectioned documentation for directional analysis, trends, maps, and evaluation
- Example workflows that can be copied into notebooks or scripts
- A place to host linked images and output figures in `docs/assets/images/`

## Suggested Example Assets

If you want the book to feel polished on GitHub Pages, add a few generated examples to:

```text
docs/assets/images/examples/
```

Suggested files:

- `wind-rose.png`
- `calendar-2025.png`
- `time-proportion-by-site.png`
- `trend-level-month-hour.png`
- `network-map.png`
- `polar-map.png`

## Images and Figures

Static images can be stored in:

```text
docs/assets/images/
```

Generated examples can be committed under:

```text
docs/assets/images/examples/
```

and then linked from any page with normal Markdown:

```md
![Example plot](assets/images/examples/calendar-2025.png)
```

Continue to [Why airqoair](introduction.md) to get started.
