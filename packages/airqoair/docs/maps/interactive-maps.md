# Mapping and networks

Interactive map functions return HTML outputs backed by `folium`.

![Map example](../assets/images/examples/network-map.png){ width="460" }

The mapping layer in `airqoair` is designed around a few recurring needs:

- show stations with pollutant-aware colour scales
- aggregate repeated observations by site
- switch between base maps
- add clustering and heat-map layers
- map connections, directional vectors, polar plots, and trajectories

## Reading This Chapter

The mapping functions are complementary rather than interchangeable:

- `station_map()` for point observations or aggregated sites
- `network_visualization()` for links or flows between locations
- `directional_map()` for vector-like directional information
- `polar_map()` for site-level directional summaries placed on a map
- `trajectory_analysis()` for ordered paths through space

## Core functions

- `station_map()`
- `map_primer()`
- `network_visualization()`
- `directional_map()`
- `polar_map()`
- `trajectory_analysis()`

## Station maps

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

## Network maps

```python
import airqoair as aq

aq.network_visualization(
    "site_links.csv",
    weight="weight",
    control="network_group",
).save("outputs/network.html")
```

## Directional maps

```python
import airqoair as aq

aq.directional_map(
    "kampala.csv",
    value="pm2_5",
).save("outputs/directional_map.html")
```

## Polar maps

```python
import airqoair as aq

aq.polar_map(
    "kampala.csv",
    site_col="site_name",
    pollutant="pm2_5",
    kind="polar_plot",
).save("outputs/polar_map.html")
```

## Trajectories

```python
import airqoair as aq

aq.trajectory_analysis(
    "trajectories.json",
    date_col="date",
).save("outputs/trajectories.html")
```
