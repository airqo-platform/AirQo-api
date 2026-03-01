# airqosm

`airqosm` is a lightweight Python package for:
- fetching source metadata from the AirQo Platform spatial API
- normalizing the platform response into a stable `{message, data}` shape
- inferring likely air pollution source metadata locally from features when needed

The local inference engine works from:
- site context (`category`, `landuse`, `natural`, `highway`)
- satellite pollutant summary means (`SO2`, `HCHO`, `CO`, `NO2`, `O3`, `AOD`)

It can run as:
- a Python client (`SourceMetadataClient`)
- a Python library (`SourceMetadataEngine`)
- an optional Flask API (`airqosm-api`)

## Requirements

- Python `>=3.9`
- Dependencies are managed in `pyproject.toml`

### Do I need a `requirements.txt`?

No, not for this package.

This package is already standards-based and pip-installable using `pyproject.toml` (PEP 517/518/621).  
Use `requirements.txt` only if you specifically want a separate pinned file for CI/runtime environments.

## Install

From PyPI:

```bash
pip install airqosm
```

Install with API server support:

```bash
pip install "airqosm[api]"
```

From this monorepo (editable mode):

```bash
cd packages/airqo-source-metadata
pip install -e .
```

## Authentication

This package uses an AirQo API token to call protected AirQo platform endpoints.

Generate your token from AirQo Analytics:
- Log in at `https://analytics.airqo.net/`
- Open your account settings
- Under the API tab, register a client and generate an access token

You can then pass the token directly or set `AIRQO_PLATFORM_TOKEN` / `AIRQO_API_TOKEN`.

## Library Quick Start

Simple import style:

```python
import airqosm

result = airqosm.source_metadata(
    latitude=5.798044,
    longitude=-0.8212,
    token="your-airqo-api-token",
)

print(result["data"]["primary_source"])
```

Direct helper imports:

```python
from airqosm import candidate_sources, primary_source

print(primary_source(5.798044, -0.8212, token="your-airqo-api-token"))
print(candidate_sources(5.798044, -0.8212, token="your-airqo-api-token"))
```

Fetch from AirQo Platform:

```python
from airqosm import SourceMetadataClient

client = SourceMetadataClient(token="your-airqo-api-token")

response = client.fetch(
    latitude=5.798044,
    longitude=-0.8212,
    include_satellite=True,
)

print(response["data"]["primary_source"])
```

The client automatically unwraps singleton list wrappers such as `[[{...}]]` and returns:

```python
{
    "message": "Operation successful",
    "data": {
        "primary_source": {...},
        "candidate_sources": [...],
        ...
    },
}
```

Run local inference from features:

```python
from airqosm import SourceMetadataEngine

engine = SourceMetadataEngine()

result = engine.build_from_features(
    latitude=0.322502,
    longitude=32.584726,
    site_category={
        "category": "Urban Background",
        "landuse": "commercial",
        "natural": "unknown",
        "highway": "primary",
        "area_name": "Kampala",
        "search_radius": 100,
        "waterway": "unknown",
    },
    satellite_pollutants_mean={
        "SO2": 0.00007,
        "HCHO": 0.00012,
        "CO": 0.05,
        "NO2": 0.00009,
        "O3": 0.14,
        "AOD": 1.2,
    },
    include_satellite=True,
)

print(result["primary_source"])
```

## Run API

```bash
airqosm-api --host 0.0.0.0 --port 8010 --platform-token your-airqo-api-token
```

The API command requires the optional API extra:

```bash
pip install "airqosm[api]"
```

Base URL: `http://127.0.0.1:8010`

### Endpoints

- `GET /healthz`
- `GET /api/v2/spatial/source_metadata`
- `POST /api/v1/source-metadata/from-features`
- `POST /api/v1/source-metadata/batch-from-features`

## API Examples

Coordinate lookup through the platform client:

```bash
curl "http://127.0.0.1:8010/api/v2/spatial/source_metadata?latitude=5.798044&longitude=-0.8212&include_satellite=true&token=your-airqo-api-token"
```

Single request:

```bash
curl -X POST "http://127.0.0.1:8010/api/v1/source-metadata/from-features" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 0.322502,
    "longitude": 32.584726,
    "site_category": {
      "category": "Urban Background",
      "landuse": "commercial",
      "natural": "unknown",
      "highway": "primary"
    },
    "satellite_pollutants_mean": {
      "SO2": 0.00007,
      "HCHO": 0.00012,
      "CO": 0.05,
      "NO2": 0.00009,
      "O3": 0.14,
      "AOD": 1.2
    }
  }'
```

Batch request:

```bash
curl -X POST "http://127.0.0.1:8010/api/v1/source-metadata/batch-from-features" \
  -H "Content-Type: application/json" \
  -d '{
    "include_satellite": true,
    "items": [
      {
        "id": "site-1",
        "latitude": 0.322502,
        "longitude": 32.584726,
        "site_category": {"category": "Urban Background", "landuse": "commercial", "natural": "unknown", "highway": "primary"},
        "satellite_pollutants_mean": {"SO2": 0.00007, "HCHO": 0.00012, "CO": 0.05, "NO2": 0.00009, "O3": 0.14, "AOD": 1.2}
      },
      {
        "id": "site-2",
        "latitude": 0.347596,
        "longitude": 32.582520,
        "site_category": {"category": "Major Highway", "landuse": "industrial", "natural": "unknown", "highway": "trunk"},
        "satellite_pollutants_mean": {"SO2": 0.0001, "HCHO": 0.00011, "CO": 0.06, "NO2": 0.00012, "O3": 0.13, "AOD": 1.0}
      }
    ]
  }'
```

## Build and Publish (PyPI)

```bash
cd packages/airqo-source-metadata
python -m pip install --upgrade build twine
python -m build
python -m twine check dist/*
python -m twine upload dist/*
```

## License

MIT
