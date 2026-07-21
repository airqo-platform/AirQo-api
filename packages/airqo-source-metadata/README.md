# airqosm

`airqosm` is a lightweight Python client for the AirQo source metadata API. Given a latitude and longitude, it returns ranked likely pollution sources together with the geographic and Sentinel-2 evidence used by the API.


## Requirements

- Python 3.9 or newer
- An AirQo API token

## Installation

```bash
pip install airqosm
```

From this repository:

```bash
cd packages/airqo-source-metadata
pip install -e .
```

Install the optional local proxy server:

```bash
pip install "airqosm[api]"
```

## Authentication

Pass a token directly or set `AIRQO_PLATFORM_TOKEN` or `AIRQO_API_TOKEN`.

```powershell
$env:AIRQO_API_TOKEN = "your-airqo-api-token"
```

Tokens can be generated from the API section of your AirQo Nexus account at <https://nexus.airqo.net/>.

## Quick start

```python
import airqosm

response = airqosm.source_metadata(
    latitude=0.230918,
    longitude=32.614595,
    include_satellite=True,
)

print(response["data"]["primary_source"])
print(response["data"]["candidate_sources"])
print(response["data"]["evidence"]["sentinel2_context"])
```

A token may also be passed explicitly:

```python
from airqosm import SourceMetadataClient

client = SourceMetadataClient(token="your-airqo-api-token", timeout=30)
response = client.fetch(
    latitude=0.230918,
    longitude=32.614595,
    include_satellite=True,
)
```

Convenience helpers return only one part of the response:

```python
from airqosm import candidate_sources, primary_source

primary = primary_source(0.230918, 32.614595, include_satellite=False)
candidates = candidate_sources(0.230918, 32.614595)
```

## Response format

The platform may wrap a single result in one or more singleton arrays. The client removes those wrappers and always returns a dictionary with `message` and `data`:

```json
{
  "message": "Operation successful",
  "data": {
    "location": {
      "area_name": "Munyonyo",
      "latitude": 0.230918,
      "longitude": 32.614595
    },
    "primary_source": {
      "source_type": "traffic",
      "confidence": 0.3478
    },
    "candidate_sources": [
      {"source_type": "traffic", "confidence": 0.3478},
      {"source_type": "mixed_urban", "confidence": 0.3478},
      {"source_type": "biomass_burning", "confidence": 0.1739}
    ],
    "evidence": {
      "site_category": {
        "category": "Urban Background",
        "classification_confidence": 0.65,
        "classification_method": "nominatim",
        "highway": "residential"
      },
      "reasoning": [
        "The point is in a built-up urban or residential context.",
        "Road type 'residential' supports local traffic influence."
      ],
      "sentinel2_context": {
        "provider": "Element 84 Earth Search",
        "collection": "sentinel-2-l2a",
        "indices": {
          "ndvi": 0.7655,
          "ndbi": -0.2435,
          "ndwi": -0.6834,
          "bare_soil_index": -0.2025,
          "normalized_burn_ratio": 0.5337
        }
      },
      "sentinel2_error": null
    },
    "metadata": {
      "model_version": "2.0.0",
      "satellite_data_used": true,
      "cache_hit": false
    }
  }
}
```

Treat source attribution as contextual evidence, not direct emissions measurement. The API disclaimer and reasoning fields should be retained when results are shown to end users.

## Satellite context

`include_satellite=True` requests free Copernicus Sentinel-2 L2A land-surface context through Element 84 Earth Search. It adds vegetation, built-up, water, bare-soil, and burn-ratio indices.

Set `include_satellite=False` for a faster OSM/site-category-only request.

## Optional query parameters

Additional platform query parameters can be supplied without allowing core request fields to be overwritten:

```python
response = client.fetch(
    latitude=0.230918,
    longitude=32.614595,
    extra_params={"start_date": "2026-04-23", "end_date": "2026-06-22"},
)
```

`extra_params` cannot replace `latitude`, `longitude`, `include_satellite`, or `token`.

## Errors

Invalid coordinates and configuration raise `ValueError`. Network, HTTP, invalid JSON, and malformed platform responses raise `SourceMetadataClientError`:

```python
from airqosm import SourceMetadataClientError, source_metadata

try:
    response = source_metadata(0.230918, 32.614595)
except SourceMetadataClientError as error:
    print(error.status_code)
    print(error.payload)
```

## Optional proxy API

Run a local proxy backed by the AirQo platform:

```bash
airqosm-api --host 0.0.0.0 --port 8010 --platform-token your-airqo-api-token
```

Endpoints:

- `GET /healthz`
- `GET /api/v2/spatial/source_metadata`

```bash
curl "http://127.0.0.1:8010/api/v2/spatial/source_metadata?latitude=0.230918&longitude=32.614595&include_satellite=true"
```

If `--platform-token` is omitted, callers must provide `Authorization: Bearer <token>` or a `token` query parameter.

## Development
## Build and Publish (PyPI)

```bash
cd packages/airqo-source-metadata
python -m unittest discover -s tests -v
python -m pip install --upgrade build twine
python -m build
python -m twine check dist/*
python -m twine upload dist/*
```

## License

MIT
