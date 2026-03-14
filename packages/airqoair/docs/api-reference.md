# API reference

This appendix is a compact list of the main public functions. For explanations, examples, and interpretation, use the chapter pages.

## Returned Objects

Plotting functions return `AirQoFigure`.

- `.data` gives the processed data behind the plot
- `.figure` gives the underlying Matplotlib figure
- `.ax` gives the first Matplotlib axis
- `.axes` gives all Matplotlib axes

Map functions return `AirQoMap`.

## Data utilities

- `load_data()`
- `summary()`

## Temporal analysis

- `time_average()`
- `time_variation()`
- `diurnal_profile()`
- `weekday_profile()`
- `monthly_profile()`
- `diurnal_plot()`
- `weekday_plot()`
- `monthly_plot()`
- `variation_report()`

## Trend diagnostics

- `calendar_plot()`
- `time_proportion_plot()`
- `trend_level()`
- `run_regression()`
- `theil_sen_trend()`
- `smooth_trend()`
- `trend_heatmap()`

## Directional analysis

- `wind_rose()`
- `pollution_rose()`
- `percentile_rose()`
- `polar_frequency()`
- `polar_plot()`
- `polar_annulus()`

## Maps

- `station_map()`
- `map_primer()`
- `network_visualization()`
- `directional_map()`
- `polar_map()`
- `trajectory_analysis()`
