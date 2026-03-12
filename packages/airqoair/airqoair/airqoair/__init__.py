"""Openair-inspired tools for air-quality analysis in Python."""

from .directional import (
    percentile_rose,
    polar_annulus,
    polar_frequency,
    polar_plot,
    pollution_rose,
    wind_rose,
)
from .evaluation import conditional_quantiles, model_evaluation, taylor_diagram
from .interactive import directional_map, map_primer, network_visualization, polar_map, trajectory_analysis
from .mapping import station_map
from .results import AirQoFigure, AirQoMap, AirQoReport
from .temporal import (
    diurnal_plot,
    diurnal_profile,
    monthly_plot,
    monthly_profile,
    time_average,
    time_variation,
    variation_report,
    weekday_plot,
    weekday_profile,
)
from .trends import (
    calendar_plot,
    dilution_plot,
    pollutant_ratio_plot,
    run_regression,
    smooth_trend,
    theil_sen_trend,
    time_proportion_plot,
    trend_level,
    trend_heatmap,
)
from .utils import load_data, summary
from .visualization import distribution_plot, time_series_plot

__all__ = [
    "AirQoFigure",
    "AirQoMap",
    "AirQoReport",
    "calendar_plot",
    "conditional_quantiles",
    "directional_map",
    "diurnal_plot",
    "diurnal_profile",
    "dilution_plot",
    "distribution_plot",
    "load_data",
    "map_primer",
    "model_evaluation",
    "monthly_plot",
    "monthly_profile",
    "network_visualization",
    "percentile_rose",
    "polar_annulus",
    "polar_plot",
    "polar_map",
    "pollutant_ratio_plot",
    "run_regression",
    "smooth_trend",
    "time_series_plot",
    "taylor_diagram",
    "theil_sen_trend",
    "summary",
    "time_average",
    "time_proportion_plot",
    "time_variation",
    "trajectory_analysis",
    "trend_level",
    "trend_heatmap",
    "variation_report",
    "weekday_plot",
    "weekday_profile",
    "wind_rose",
    "polar_frequency",
    "pollution_rose",
    "station_map",
]
