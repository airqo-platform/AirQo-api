# airqo-source-metadata

`airqo-source-metadata` is a lightweight Python package for inferring likely air pollution source metadata from:
- site context (`category`, `landuse`, `natural`, `highway`)
- satellite pollutant summary means (`SO2`, `HCHO`, `CO`, `NO2`, `O3`, `AOD`)

It can run as:
- a Python library (`SourceMetadataEngine`)
- a Flask API (`airqo-source-metadata-api`)

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
pip install airqo-source-metadata
```

From this monorepo (editable mode):

```bash
cd packages/airqo-source-metadata
pip install -e .
```

## Library Quick Start

```python
from airqo_source_metadata import SourceMetadataEngine

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
airqo-source-metadata-api --host 0.0.0.0 --port 8010
```

Base URL: `http://127.0.0.1:8010`

### Endpoints

- `GET /healthz`
- `POST /api/v1/source-metadata/from-features`
- `POST /api/v1/source-metadata/batch-from-features`

## API Examples

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
