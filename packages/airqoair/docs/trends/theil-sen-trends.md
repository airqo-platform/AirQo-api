# Theil-Sen trends

`theil_sen_trend()` estimates a robust monotonic trend from aggregated time series data.

This is a good choice when you want a trend estimate that is less sensitive to outliers than ordinary least squares.

The implementation in `airqoair` supports:

- monthly aggregation by default with `aggregate="MS"`
- optional deseasonalising through `deseason=True`
- bootstrap confidence intervals
- significance annotation
- conditioned panels through `group_by=` or `type="wd"`

## Interpretation

The figure combines:

- the observed or deseasonalised series
- the fitted Theil-Sen line
- optional confidence bounds
- a compact summary of slope and significance

That makes it suitable both for quick exploratory analysis and for export into reports.

## Example

```python
import airqoair as aq

aq.theil_sen_trend(
    "kampala.csv",
    pollutant="pm2_5",
    deseason=True,
    n_boot=200,
).save("outputs/theil_sen.png")
```
