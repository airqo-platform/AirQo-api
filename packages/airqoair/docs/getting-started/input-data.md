# Input data

Most functions accept either a `DataFrame` or one of these file formats:

- `.csv`
- `.json`
- `.jsonl`
- `.ndjson`

## Minimum expectation

At a minimum, most analysis functions need:

- a datetime column
- one or more pollutant columns

Directional and mapping functions add further requirements such as wind variables or coordinates.

## Common columns

| Purpose | Default column |
| --- | --- |
| Datetime | `date` |
| Wind speed | `ws` |
| Wind direction | `wd` |
| Latitude | `latitude` |
| Longitude | `longitude` |

## Practical advice

- Keep timestamps in one consistent timezone before analysis
- Use one row per observation time and location
- Rename columns early if your source data uses inconsistent names
- Pass explicit column arguments when your dataset differs from the defaults

## Example

```python
import airqoair as aq

df = aq.load_data("kampala.csv")
summary = aq.summary(df, pollutant_cols=["pm2_5", "pm10"])
```
