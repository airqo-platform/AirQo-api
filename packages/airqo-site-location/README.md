# airqolocate

`airqolocate` creates recommended AirQo sensor locations for a named place. It resolves the OpenStreetMap administrative boundary with OSMnx and submits the resulting polygon to the AirQo Spatial `site_location` API.

## Requirements

- Python 3.9 or newer
- An AirQo API token

## Installation

Install the package:

```bash
pip install airqolocate
```

From this repository:

```bash
cd packages/airqo-site-location
python -m pip install -e .
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

The library resolves `Kampala, Uganda` into an OpenStreetMap polygon before calling:

```text
POST https://platform.airqo.net/api/v2/spatial/site_location?token=...
```

## Required locations

`must_have_locations` is optional. Use it when specific coordinates must be included in the result.

```python
result = locate_sites(
    "Nairobi, Kenya",
    num_sensors=5,
    min_distance_km=2.5,
    must_have_locations=[
        [-1.2790166, 36.816709],
    ],
)
```

Required locations use `[latitude, longitude]` order. `num_sensors` is the total number of returned locations, including required locations.

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

## Explicit polygon coordinates

Applications that already have a boundary can provide it directly. Polygon positions use GeoJSON `[longitude, latitude]` order.

```python
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

result = locate_sites(polygon, num_sensors=3)
```

## Additional API options

Additional supported API fields can be passed through `options`:

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

## Validation and errors

The library validates sensor counts, minimum distance, coordinates, and required-location counts before making the API request. Explicit polygon rings are closed automatically.

Place lookup and request validation errors raise `ValueError`. Missing OSMnx support raises `ImportError`. HTTP, network, timeout, invalid JSON, and malformed response errors raise `LocateClientError`.

```python
from airqolocate import LocateClientError, locate_sites

try:
    result = locate_sites("Kampala, Uganda", num_sensors=5)
except LocateClientError as error:
    print(error.status_code)
    print(error.payload)
```

## Development
## Test and build

From the repository root:

```bash
cd packages/airqo-site-location
python -m pip install --upgrade build twine
python -m unittest discover -s tests -v
python -m build
python -m twine check dist/*
python -m twine upload dist/*        
```
Remove old build artifacts before creating a release. In PowerShell:

```powershell
Remove-Item -Recurse -Force build, dist -ErrorAction SilentlyContinue
python -m build
python -m twine check (Get-ChildItem dist -File).FullName
```

## Publish to PyPI

Confirm the version in `pyproject.toml` has not already been published, then upload the validated distributions:

```powershell
python -m twine upload (Get-ChildItem dist -File).FullName
```

Use `__token__` as the username and your PyPI API token as the password. Verify the release in a clean environment:

```bash
python -m pip install airqolocate
python -c "import airqolocate; print(airqolocate.__version__)"
```
## License 

MIT
