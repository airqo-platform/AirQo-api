# airqolocate

`airqolocate` is a Python client for the AirQo Spatial site-location API. It
generates recommended sensor locations inside an explicit polygon or a named
place resolved through OpenStreetMap.

## Requirements

- Python 3.9 or newer
- An AirQo API token

## Installation

Install the client and its OSMnx dependency:

```bash
pip install airqolocate
```


For local development:

```bash
cd packages/airqo-site-location
python -m pip install -e ".[dev]"
```

## Authentication

Pass a token directly or set `AIRQO_PLATFORM_TOKEN` or `AIRQO_API_TOKEN`.

```powershell
$env:AIRQO_API_TOKEN = "your-airqo-api-token"
```

## Quick start

```python
from airqolocate import locate_sites

result = locate_sites(
    "Kampala, Uganda",
    num_sensors=5,
    min_distance_km=2.5,
)

print(result["site_location"])
```

The client resolves the place boundary and calls:

```text
POST https://platform.airqo.net/api/v2/spatial/site_location?token=...
```

## Explicit polygons

Polygon positions use GeoJSON `[longitude, latitude]` order:

```python
from airqolocate import locate_sites

polygon = {
    "coordinates": [
        [
            [32.575107, 0.305577],
            [32.607894, 0.312787],
            [32.580342, 0.291845],
            [32.575107, 0.305577],
        ]
    ]
}

result = locate_sites(
    polygon,
    num_sensors=3,
    token="your-airqo-api-token",
)
```

Open polygon rings are closed automatically.

## Required locations

`must_have_locations` is optional. Its coordinates use
`[latitude, longitude]` order:

```python
result = locate_sites(
    "Nairobi, Kenya",
    num_sensors=5,
    must_have_locations=[
        [-1.2790166, 36.816709],
    ],
)
```

`num_sensors` is the total number of returned locations, including required
locations.

## Client usage

```python
from airqolocate import LocateClient

client = LocateClient(
    token="your-airqo-api-token",
    timeout=60,
)

result = client.locate(
    polygon="Kampala, Uganda",
    num_sensors=5,
    min_distance_km=2.5,
)
```

Additional supported API fields can be supplied through `options`:

```python
result = client.locate(
    polygon="Kampala, Uganda",
    num_sensors=5,
    options={
        "include_source_metadata": True,
        "include_satellite": False,
        "water_buffer_m": 100,
        "require_water_data": True,
    },
)
```

## Errors

Input validation and unresolved place names raise `ValueError`. Named-place
lookup without the optional dependency raises `ImportError`. HTTP, network,
timeout, invalid JSON, and malformed response failures raise
`LocateClientError`.

```python
from airqolocate import LocateClientError, locate_sites

try:
    result = locate_sites("Kampala, Uganda", num_sensors=5)
except LocateClientError as error:
    print(error.status_code)
    print(error.payload)
```

## Development

Run the tests:

```bash
python -m unittest discover -s tests -v
```

Build and validate a release:

```powershell
Remove-Item -Recurse -Force build, dist -ErrorAction SilentlyContinue
python -m build
python -m twine check (Get-ChildItem dist -File).FullName
```

Before publishing, update the version in `pyproject.toml` and
`airqolocate/airqolocate/__init__.py`, update `CHANGELOG.md`, and verify the
version is not already present on PyPI.

```powershell
python -m twine upload (Get-ChildItem dist -File).FullName
``` 

## License

MIT. See [LICENSE](LICENSE).
