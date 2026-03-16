# Smooth trends

`smooth_trend()` estimates a smooth long-term trend from aggregated observations.

Smooth trends are useful when the main question is not whether a monotonic slope exists, but how the underlying level evolves over time after short-term variation has been reduced.

The implementation supports:

- monthly aggregation by default through `aggregate="MS"`
- optional `avg_time=` override
- optional deseasonalising with `deseason=True`
- bootstrap uncertainty intervals
- conditioned panels via `group_by=` or `type=`

## When To Prefer This Over Theil-Sen

Use `smooth_trend()` when:

- you expect curved or non-linear long-term behaviour
- you want a visual estimate of gradual change
- you want an uncertainty band around the smoothed line

Use `theil_sen_trend()` when:

- you want a robust monotonic slope estimate
- you need a single interpretable summary slope
- you want a clearer significance-oriented trend summary

## Example

```python
import airqoair as aq

aq.smooth_trend(
    "kampala.csv",
    pollutant="pm2_5",
    deseason=True,
    n_boot=200,
).save("outputs/smooth_trend.png")
```

Grouped example:

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
