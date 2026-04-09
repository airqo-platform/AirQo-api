# Why airqoair

`airqoair` is a Python library for air-quality diagnostics, visualisation, reporting, and mapping.

It is designed for teams that already work in the Python data ecosystem and want a focused toolkit for:

- temporal summaries and profiles
- directional analysis
- trend diagnostics
- model evaluation
- interactive maps

## Who This Package Is For

`airqoair` is intended for:

- air-quality analysts working mainly in Python
- researchers exploring measured or modelled concentrations
- engineering teams who need repeatable plots, reports, and maps in scripts or notebooks

It is especially useful when your data already lives in tabular files such as CSV or JSON and you want to move quickly from raw observations to interpretable outputs.

## Core Design Choices

- Accept either `pandas.DataFrame` objects or file paths directly
- Keep plotting outputs saveable and notebook-friendly
- Support grouped analysis such as `group_by="site_name"` or date-derived conditioning
- Avoid machine learning features inside the package itself

## Typical Workflow

Most users follow a pattern like this:

1. Load and inspect the data
2. Compute time-based summaries such as daily averages or diurnal profiles
3. Explore directional behaviour using roses or polar plots
4. Diagnose longer-term behaviour with calendar, smooth, or Theil-Sen trends
5. Publish spatial context through interactive maps

That is the order reflected in the rest of the documentation.

## Book Structure

The documentation follows the same workflow-oriented structure as the package:

- Introduction and setup
- Directional analysis
- Time series and trends
- Interactive maps
- Model evaluation
- API reference
