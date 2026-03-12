# Temporal variation

Temporal variation answers questions such as:

- how does pollution vary through the day?
- do weekdays differ from weekends?
- are there differences between sites?

![Temporal variation example](../assets/images/examples/time-proportion-by-site.png){ width="420" }

Core functions:

- `time_variation()`
- `diurnal_profile()`
- `weekday_profile()`
- `monthly_profile()`
- `diurnal_plot()`
- `weekday_plot()`
- `monthly_plot()`

## What This Chapter Covers

These tools are the first place to go when you need to understand repeated temporal structure:

- diurnal cycles
- weekday versus weekend behaviour
- month-to-month contrasts
- grouped comparisons such as multiple sites

## Conditioning

Most of the temporal plotting functions support either:

- `group_by="site_name"` to split by an existing column
- `type="season"` or another supported derived grouping

That makes the same diagnostic reusable across sites, seasons, or other categories without reshaping the data yourself.

## Example

```python
import airqoair as aq

aq.time_variation(
    "kampala.csv",
    pollutant="pm2_5",
    group_by="site_name",
).save("outputs/time_variation_by_site.png")
```

## Customising The Matplotlib Output

Temporal plotting functions return `AirQoFigure`, so you can customise the underlying Matplotlib objects before saving.

For a single-axis plot:

```python
import airqoair as aq

result = aq.diurnal_plot("kampala.csv", pollutant="pm2_5", type="season")
result.ax.set_title("Diurnal PM2.5 by season")
result.ax.set_xlabel("Hour of day")
result.ax.set_ylabel("PM2.5 (ug/m3)")
```

For a multi-panel figure:

```python
import airqoair as aq

result = aq.time_variation("kampala.csv", pollutant="pm2_5")

for axis in result.axes:
    axis.grid(alpha=0.15)
```

The full figure is available as `result.figure` when you need figure-level control.
