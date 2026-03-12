# airqoair

`airqoair` is a Python library for air-quality analysis, plotting, reporting, and interactive maps.

It is designed for environmental monitoring workflows where you want:
- direct input from `pandas.DataFrame`, `.csv`, `.json`, `.jsonl`, or `.ndjson`
- temporal diagnostics such as diurnal, weekday, monthly, and grouped site comparisons
- directional analysis such as wind roses, pollution roses, and polar plots
- interactive map outputs with `folium`
- no machine learning or forecasting in the package itself

## Install

From PyPI:

```bash
pip install airqoair
```

From this monorepo for development:

```bash
cd packages/airqoair
pip install -e ".[dev]"
```

## Quick Start

```python
import airqoair as aq

daily = aq.time_average(
    "kampala.csv",
    avg="D",
    pollutant_cols=["pm2_5", "pm10"],
)

variation = aq.time_variation("kampala.csv", pollutant="pm2_5")
monthly = aq.monthly_plot("kampala.csv", pollutant="pm2_5")
rose = aq.wind_rose("kampala.csv")
site_map = aq.station_map("kampala.csv", value="pm2_5")

print(daily.head())

variation.save("outputs/time_variation.png")
monthly.save("outputs/monthly_profile.png")
rose.save("outputs/wind_rose.png")
site_map.save("outputs/stations.html")
```

## Grouped Conditioning

One of the most useful analysis patterns is conditioning the same workflow by site, year, season, or other categories.

`airqoair` supports this in the temporal workflow through:
- `group_by="site_name"` for an existing column in your data
- `type="year"`, `type="monthyear"`, `type="season"`, `type="weekday"`, or `type="weekend"` for derived date-based conditioning

Monthly bars by site:

```python
import airqoair as aq

monthly_by_site = aq.monthly_plot(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
)

monthly_by_site.save("outputs/monthly_by_site.png")
```

Diurnal profile by season:

```python
import airqoair as aq

diurnal_by_season = aq.diurnal_plot(
    "kampala.csv",
    pollutant="pm2_5",
    type="season",
)

diurnal_by_season.save("outputs/diurnal_by_season.png")
```

Monthly profile table by site:

```python
import airqoair as aq

monthly = aq.monthly_profile(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
)

print(monthly.head())
```

## Accepted Inputs

Most functions accept either a `DataFrame` or a file path.

Supported file formats:
- `.csv`
- `.json`
- `.jsonl`
- `.ndjson`

Examples:

```python
import airqoair as aq

df = aq.load_data("kampala.jsonl")
daily = aq.time_average(df, avg="D", pollutant_cols=["pm2_5"])
```

```python
import airqoair as aq

variation = aq.time_variation("kampala.json", pollutant="pm2_5")
```

## Expected Columns

Defaults assume these names:

| Purpose | Default column(s) |
| --- | --- |
| datetime | `date` |
| pollutant examples | `pm2_5`, `pm10`, `no2`, `o3` |
| wind speed | `ws` |
| wind direction | `wd` |
| latitude | `latitude` |
| longitude | `longitude` |

You can override them in function calls, for example:

```python
import airqoair as aq

aq.wind_rose("kampala.csv", ws="wind_speed", wd="wind_direction")
aq.station_map("kampala.csv", latitude="lat", longitude="lon", value="pm2_5")
aq.time_average("kampala.csv", date_col="timestamp", pollutant_cols=["pm2_5"])
```

## Feature Coverage

### Directional Analysis

- `wind_rose()`
- `pollution_rose()`
- `percentile_rose()`
- `polar_frequency()`
- `polar_plot()`
- `polar_annulus()`

### Time Series, Profiles, and Reports

- `time_average()`
- `time_variation()`
- `diurnal_profile()`
- `weekday_profile()`
- `monthly_profile()`
- `diurnal_plot()`
- `weekday_plot()`
- `monthly_plot()`
- `variation_report()`

### Visualization and Trends

- `time_series_plot()`
- `distribution_plot()`
- `calendar_plot()`
- `time_proportion_plot()`
- `trend_level()`
- `run_regression()`
- `theil_sen_trend()`
- `smooth_trend()`
- `dilution_plot()`
- `pollutant_ratio_plot()`
- `trend_heatmap()`

### Model Evaluation

- `model_evaluation()`
- `taylor_diagram()`
- `conditional_quantiles()`

### Interactive Maps

- `station_map()`
- `map_primer()`
- `network_visualization()`
- `directional_map()`
- `polar_map()`
- `trajectory_analysis()`

## Common Workflows

### Diurnal, Weekday, and Monthly Summaries

```python
import airqoair as aq

diurnal = aq.diurnal_profile("kampala.csv", pollutant="pm2_5")
weekday = aq.weekday_profile("kampala.csv", pollutant="pm2_5")
monthly = aq.monthly_profile("kampala.csv", pollutant="pm2_5")
```

### Grouped Site Comparison

```python
import airqoair as aq

variation = aq.time_variation(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
)

report = aq.variation_report(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
)

print(report.sections["summary"].head())
variation.save("outputs/site_time_variation.png")
```

### Directional Analysis

```python
import airqoair as aq

aq.wind_rose("kampala.csv").save("outputs/wind_rose.png")
aq.percentile_rose("kampala.csv", pollutant="pm2_5").save("outputs/percentile_rose.png")
aq.polar_plot("kampala.csv", pollutant="pm2_5").save("outputs/polar_plot.png")
```

### Time Trends

```python
import airqoair as aq

aq.calendar_plot("kampala.csv", pollutant="pm2_5").save("outputs/calendar.png")
aq.smooth_trend("kampala.csv", pollutant="pm2_5", deseason=True, n_boot=200).save("outputs/smooth_trend.png")
aq.trend_heatmap("kampala.csv", pollutant="pm2_5").save("outputs/trend_heatmap.png")
```

Calendar plot with daily value labels and discrete bands:

```python
import airqoair as aq

aq.calendar_plot(
    "kampala.csv",
    pollutant="pm2_5",
    year=2025,
    annotate="value",
    breaks=[0, 15, 35, 55, 150],
    labels=["Good", "Moderate", "Unhealthy", "Very Unhealthy"],
    lim=35,
).save("outputs/calendar_2025.png")
```

Time proportion plot split by site or wind sector over time:

```python
import airqoair as aq

aq.time_proportion_plot(
    "kampala.csv",
    pollutant="pm2_5",
    proportion="site_name",
    avg_time="7D",
).save("outputs/time_proportion_by_site.png")

aq.time_proportion_plot(
    "kampala.csv",
    pollutant="pm2_5",
    proportion="wd",
    avg_time="1M",
    sector_count=8,
).save("outputs/time_proportion_by_wind_sector.png")
```

Trend-level heat map across month and hour:

```python
import airqoair as aq

aq.trend_level(
    "kampala.csv",
    pollutant="pm2_5",
    x="month",
    y="hour",
).save("outputs/trend_level_month_hour.png")
```

Rolling regression diagnostics:

```python
import airqoair as aq

aq.run_regression(
    "kampala.csv",
    x="ws",
    y="pm2_5",
    avg_time="MS",
    window=12,
).save("outputs/run_regression.png")
```

Theil-Sen trend with deseasonalising and confidence intervals:

```python
import airqoair as aq

aq.theil_sen_trend(
    "kampala.csv",
    pollutant="pm2_5",
    deseason=True,
    n_boot=200,
).save("outputs/theil_sen_trend.png")
```

Smooth trend with deseasonalising and grouped site panels:

```python
import airqoair as aq

aq.smooth_trend(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
    deseason=True,
    n_boot=200,
).save("outputs/smooth_trend_by_site.png")
```

### Maps

```python
import airqoair as aq

aq.station_map("kampala.csv", value="pm2_5").save("outputs/stations.html")
aq.directional_map("kampala.csv").save("outputs/directional_map.html")
aq.polar_map("kampala.csv", site_col="site_name", pollutant="pm2_5", kind="polar_plot").save("outputs/polar_map.html")
```

Grouped interactive map with clustering, marker scaling, and a heat layer:

```python
import airqoair as aq

aq.station_map(
    "kampala.csv",
    value="pm2_5",
    group_by="site_name",
    radius_col="device_count",
    cluster=True,
    heatmap=True,
    tiles=["CartoDB positron", "OpenStreetMap"],
).save("outputs/stations_grouped.html")
```

## Returned Objects

Plotting functions return `AirQoFigure`.
- `.data` contains the processed table behind the plot
- `.figure` is the underlying Matplotlib figure
- `.show()` displays the plot
- `.save(path)` writes the plot to disk

Map functions return `AirQoMap`.
- `.data` contains the mapped rows
- `.map` is the underlying `folium.Map`
- `.save(path)` writes the HTML map

`variation_report()` returns `AirQoReport`.
- `.sections` contains summary and profile tables
- `.save_markdown(path)` writes a markdown report
- `.save_figure(path)` writes the report figure

## Current Scope

`airqoair` is designed for practical air-quality diagnostics in Python, but it is not yet a full feature-for-feature replacement for every established toolkit in this space.

This package currently focuses on:
- practical temporal profiles and grouped conditioning
- directional analysis and mapping
- trend and evaluation utilities that are straightforward to use from Python data workflows

## Development

Run tests from the package root:

```bash
cd packages/airqoair
python -m pytest tests
```

If you are working from the repo without installation, point `PYTHONPATH` at `packages/airqoair`, not the repository root.

## Documentation site

A book-style documentation site scaffold is included under:

```text
packages/airqoair/docs/
packages/airqoair/mkdocs.yml
```

To build it locally:

```bash
cd packages/airqoair
pip install -e ".[docs]"
mkdocs serve
```

Images for the docs can be stored in:

```text
packages/airqoair/docs/assets/images/
```

## .gitignore

The package-local `.gitignore` excludes:
- Python caches and bytecode
- virtual environments
- pytest, coverage, mypy, ruff, tox, and nox caches
- build artifacts and editable-install metadata
- generated plots, HTML maps, markdown reports, and temporary outputs

## License

MIT
