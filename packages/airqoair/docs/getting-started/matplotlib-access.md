# Matplotlib Access

Every plotting function in `airqoair` returns an `AirQoFigure`.

That wrapper keeps the processed data table and the underlying Matplotlib figure together so you can both inspect the result and customise the plot before saving it.

## What `AirQoFigure` Provides

- `.data` for the processed data behind the plot
- `.figure` for the raw Matplotlib `Figure`
- `.ax` for the first axis on the figure
- `.axes` for all axes on the figure
- `.show()` to display the figure
- `.save(path)` to save it to disk

## Single-Axis Plots

Functions such as `diurnal_plot()`, `weekday_plot()`, `monthly_plot()`, `time_series_plot()`, and `distribution_plot()` create a single main axis.

Use `.ax` when you want a quick Matplotlib handle:

```python
import airqoair as aq

result = aq.diurnal_plot("kampala.csv", pollutant="pm2_5")

ax = result.ax
ax.set_title("Diurnal PM2.5 Variation")
ax.set_xlabel("Hour of Day")
ax.set_ylabel("PM2.5 (ug/m3)")

result.save("outputs/diurnal_customised.png")
```

## Multi-Axis Plots

Some functions create multiple panels, for example `time_variation()`, `run_regression()`, and several grouped trend diagnostics.

Use `.axes` when you need access to every subplot:

```python
import airqoair as aq

result = aq.time_variation("kampala.csv", pollutant="pm2_5")

for axis in result.axes:
    axis.grid(alpha=0.15)

result.axes[0].set_title("Hourly pattern")
result.axes[1].set_title("Weekday pattern")
```

`.ax` still works for multi-axis figures, but it always returns the first axis only.

## Full Figure Control

If you need direct figure-level operations such as `suptitle`, `tight_layout`, or custom colorbars, use `.figure`:

```python
import airqoair as aq

result = aq.time_series_plot("kampala.csv", pollutant=["pm2_5", "pm10"])

result.figure.suptitle("Kampala time series overview")
result.figure.set_facecolor("white")
```

## Maps Are Different

Interactive mapping functions return `AirQoMap`, not `AirQoFigure`.

For maps, use:

- `.data` for the mapped rows
- `.map` for the underlying `folium.Map`
- `.save(path)` to write the HTML output
