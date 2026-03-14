# Run regression

`run_regression()` computes rolling ordinary least squares regressions over aggregated time windows.

This diagnostic is useful when you do not only want a trend in one variable, but a changing relationship between two variables over time.

It is useful when you want to understand how the relationship between two variables changes over time, for example:

- pollutant versus wind speed
- pollutant versus another pollutant
- concentration versus dilution proxy

## What The Output Means

The returned figure shows the rolling:

- slope
- coefficient of determination (`R squared`)
- intercept

The returned `.data` table also includes correlation and RMSE, which are useful when you want to filter or summarise the regression windows after plotting.

The function returns an `AirQoFigure` whose `.data` contains rolling regression diagnostics such as:

- `slope`
- `intercept`
- `r_squared`
- `correlation`
- `rmse`

## Example

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

Grouped example:

```python
import airqoair as aq

aq.run_regression(
    "kampala.csv",
    x="ws",
    y="pm2_5",
    avg_time="MS",
    window=12,
    group_by="site_name",
).save("outputs/run_regression_by_site.png")
```
