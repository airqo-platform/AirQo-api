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
