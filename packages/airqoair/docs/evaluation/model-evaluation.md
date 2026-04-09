# Evaluation and diagnostics

This chapter covers tools for comparing observed and predicted values, or for describing conditional relationships in paired variables.

## Core functions

- `model_evaluation()`
- `taylor_diagram()`
- `conditional_quantiles()`

## What Each Tool Is For

- `model_evaluation()` summarises standard performance metrics in a compact report object
- `taylor_diagram()` compares pattern similarity, variability, and correlation in one plot
- `conditional_quantiles()` shows how one variable behaves across quantiles of another

## Example

```python
import airqoair as aq

evaluation = aq.model_evaluation(
    observed=[10, 20, 30, 40],
    predicted=[12, 18, 29, 43],
)

diagram = aq.taylor_diagram(
    observed=[10, 20, 30, 40],
    predicted=[12, 18, 29, 43],
)

print(evaluation.sections["metrics"])
diagram.save("outputs/taylor_diagram.png")
```
