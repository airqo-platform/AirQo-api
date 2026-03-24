"""
example_usage.py — Practical examples for every adapter in airqo_etl_utils.sources
====================================================================================

All adapters share the same interface (defined in adapter.py):

    adapter.fetch(device, dates, resolution) -> Result

``Result`` attributes:
    result.data          – dict with keys ``"records"`` (list) and ``"meta"`` (dict)
    result.error         – None on success, error string on failure

Run individual sections as stand-alone scripts.
The examples that talk to live APIs require environment configuration to be
present (secrets.json / env vars) — see env.sample at the repo root.
"""

# ---------------------------------------------------------------------------
# 0.  Shared helpers
# ---------------------------------------------------------------------------


def print_result(label: str, result) -> None:
    """Pretty-print a Result object."""
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    if result.error:
        print(f"  ERROR  : {result.error}")
    records = (result.data or {}).get("records", [])
    meta = (result.data or {}).get("meta", {})
    print(f"  records: {len(records)} item(s)")
    if records:
        print(f"  first  : {records[0]}")
    if meta:
        print(f"  meta   : {meta}")


# ---------------------------------------------------------------------------
# 1.  ThingSpeakAdapter  (AirQo low-cost sensors)
# ---------------------------------------------------------------------------
# ThingSpeak is the upstream time-series store for AirQo devices.
# Each device maps to a ThingSpeak *channel*; ``device_number`` is the
# channel ID and ``key`` is the read-only API key (may be Fernet-encrypted).
#
# The adapter transparently decrypts Fernet tokens that start with "gAAAA".
# ---------------------------------------------------------------------------


def example_thingspeak():
    from airqo_etl_utils.sources.thingspeak_adapter import ThingSpeakAdapter

    adapter = ThingSpeakAdapter()

    device = {
        "device_number": 123456,  # ThingSpeak channel ID
        "key": "YOUR_READ_API_KEY",  # plain-text OR Fernet-encrypted key
    }

    # Each tuple is an ISO-8601 (start, end) window.
    # ThingSpeak enforces a maximum of 8 000 entries per request, so split
    # large time ranges into smaller windows.
    dates = [
        ("2024-01-01T00:00:00Z", "2024-01-01T12:00:00Z"),
        ("2024-01-01T12:00:00Z", "2024-01-02T00:00:00Z"),
    ]

    result = adapter.fetch(device, dates)
    print_result("ThingSpeakAdapter", result)

    # Access records and channel metadata individually
    records = result.data["records"]  # list of ThingSpeak feed dicts
    meta = result.data["meta"]  # ThingSpeak channel metadata dict
    channel_name = meta.get("name")  # e.g. "KCCA_Kampala_001"
    print(f"  channel : {channel_name}, feeds fetched: {len(records)}")


# ---------------------------------------------------------------------------
# 2.  IQAirAdapter  (IQAir cloud API)
# ---------------------------------------------------------------------------
# IQAir devices are polled from a REST endpoint identified by ``api_code``
# (base URL) and ``serial_number`` (device identifier appended to the URL).
#
# ``resolution`` controls which sub-key is read from the API response:
#   "current"  → latest reading
#   "instant" / "hourly" / "daily" / "monthly"  → historical data
# ---------------------------------------------------------------------------


def example_iqair():
    from airqo_etl_utils.sources.iqair_adapter import IQAirAdapter

    adapter = IQAirAdapter()

    device = {
        "api_code": "https://api.iqair-partner.com/v1/devices",
        "serial_number": "SN-IQAIR-0042",
    }

    # dates is accepted for interface parity but not used by IQAir;
    # the API always returns the most recent data for the given resolution.
    result = adapter.fetch(device, dates=None, resolution="hourly")
    print_result("IQAirAdapter (hourly)", result)

    # Fetch the current (live) reading instead
    result_current = adapter.fetch(device, resolution="current")
    print_result("IQAirAdapter (current)", result_current)


# ---------------------------------------------------------------------------
# 3.  AirGradientAdapter  (AirGradient open-source monitors)
# ---------------------------------------------------------------------------
# AirGradient devices are queried through the AirGradient cloud API.
# ``api_code`` is the base URL; ``serial_number`` is the device serial.
# Dates must be ISO-8601 strings formatted as "%Y-%m-%dT%H:%M:%SZ".
# ---------------------------------------------------------------------------


def example_airgradient():
    from airqo_etl_utils.sources.airgradient_adapter import AirGradientAdapter

    adapter = AirGradientAdapter()

    device = {
        "api_code": "https://api.airgradient.com/v1",
        "serial_number": "AG-00AABBCCDDEE",
        "device_id": "ag-monitor-kampala-1",  # used in error messages only
    }

    dates = [
        ("2024-03-01T00:00:00Z", "2024-03-02T00:00:00Z"),
    ]

    result = adapter.fetch(device, dates)
    print_result("AirGradientAdapter", result)


# ---------------------------------------------------------------------------
# 4.  TahmoAdapter  (TAHMO weather-station network)
# ---------------------------------------------------------------------------
# TAHMO is a network of automatic weather stations across Africa.
# Provide a list of station codes in the ``device`` dict; the adapter will
# query each station over every (start, end) date range.
# ---------------------------------------------------------------------------


def example_tahmo():
    from airqo_etl_utils.sources.tahmo_adapter import TahmoAdapter

    adapter = TahmoAdapter()

    device = {
        # Stations can be listed under either "stations" or "station_codes"
        "stations": ["TA00001", "TA00002"],
    }

    dates = [
        ("2024-06-01T00:00:00Z", "2024-06-07T23:59:59Z"),
    ]

    result = adapter.fetch(device, dates)
    print_result("TahmoAdapter", result)

    # Records are dicts from DataFrame.to_dict("records"); each row is one
    # station measurement (temperature, humidity, wind speed, …)
    for rec in result.data["records"][:3]:
        print(f"  {rec}")


# ---------------------------------------------------------------------------
# 5.  OpenWeatherAdapter  (OpenWeather current-conditions endpoint)
# ---------------------------------------------------------------------------
# Fetches current weather at the given geographic coordinates.
# Provide ``latitude`` / ``longitude``, or the ``site_coordinates`` tuple.
# Requires OPENWEATHER_API_KEY to be set in configuration.
# ---------------------------------------------------------------------------


def example_openweather():
    from airqo_etl_utils.sources.openweather_adapter import OpenWeatherAdapter

    adapter = OpenWeatherAdapter()

    # Option A — explicit lat/lon
    device_latlon = {
        "latitude": 0.3163,
        "longitude": 32.5822,
    }

    # Option B — site_coordinates tuple  (lat, lon)
    device_coords = {
        "site_coordinates": (0.3163, 32.5822),
    }

    result = adapter.fetch(device_latlon)
    print_result("OpenWeatherAdapter (lat/lon)", result)

    result_b = adapter.fetch(device_coords)
    print_result("OpenWeatherAdapter (site_coordinates)", result_b)


# ---------------------------------------------------------------------------
# 6.  NomadsAdapter  (NOAA NOMADS GRIB2 forecast files)
# ---------------------------------------------------------------------------
# Downloads the current GRIB2 forecast file from NOAA's NOMADS server.
# The download URL and filename are derived from internal configuration.
# ``device`` and ``dates`` are unused — this adapter fetches a global file.
# The result meta dict contains the local path of the downloaded file.
# ---------------------------------------------------------------------------


def example_nomads():
    from airqo_etl_utils.sources.nomads_adapter import NomadsAdapter

    adapter = NomadsAdapter()

    # device and dates are not used by NomadsAdapter but are accepted for
    # interface consistency — pass None or empty values.
    result = adapter.fetch(device=None, dates=None)
    print_result("NomadsAdapter", result)

    # On success, meta["file"] holds the path to the downloaded GRIB2 file
    downloaded_path = result.data.get("meta", {}).get("file")
    if downloaded_path:
        print(f"  GRIB2 file saved to: {downloaded_path}")


# ---------------------------------------------------------------------------
# 7.  BigQueryAdapter  (Google BigQuery load / download)
# ---------------------------------------------------------------------------
# Unlike the other adapters, BigQueryAdapter is not a DataSourceAdapter —
# it wraps BigQuery load jobs and query downloads rather than polling a
# third-party API.  It is used internally by BigQueryApi.
# ---------------------------------------------------------------------------


def example_bigquery():
    import pandas as pd
    from airqo_etl_utils.sources.bigquery_adapter import BigQueryAdapter
    from airqo_etl_utils.constants import JobAction

    # Initialise with an explicit client to avoid touching live GCP credentials
    # in this example.  In production, omit `client` and let it default to
    # bigquery.Client() which reads GOOGLE_CLOUD_PROJECT / ADC credentials.
    adapter = BigQueryAdapter()

    # --- Loading data into BigQuery ---
    df = pd.DataFrame(
        {
            "device_id": ["device1", "device2"],
            "pm2_5": [25.4, 30.1],
            "timestamp": ["2024-01-01T00:00:00Z", "2024-01-01T01:00:00Z"],
        }
    )

    # job_action controls write disposition:
    #   JobAction.APPEND   → append rows (default)
    #   JobAction.OVERWRITE → truncate then load
    info = adapter.load_dataframe(
        dataframe=df,
        table="your-gcp-project.dataset.table",
        job_action=JobAction.APPEND,
    )
    print(f"\nBigQueryAdapter.load_dataframe")
    print(f"  rows_loaded : {info['rows_loaded']}")
    print(f"  total_rows  : {info['total_rows']}")


# ---------------------------------------------------------------------------
# 8.  registry.py — selecting an adapter by network at runtime
# ---------------------------------------------------------------------------
# ``get_adapter`` returns the right adapter for a given DeviceNetwork enum or
# its string representation.  ``fetch_from_adapter`` is a one-shot helper
# that also wraps errors into a canonical Result.
# ---------------------------------------------------------------------------


def example_registry():
    from airqo_etl_utils.sources.registry import get_adapter, fetch_from_adapter
    from airqo_etl_utils.constants import DeviceNetwork

    # --- get_adapter: instantiate the right adapter ---
    adapter = get_adapter(DeviceNetwork.AIRQO)
    print(f"\nget_adapter(AIRQO) → {type(adapter).__name__}")  # ThingSpeakAdapter

    adapter = get_adapter(DeviceNetwork.IQAIR)
    print(f"get_adapter(IQAIR)  → {type(adapter).__name__}")  # IQAirAdapter

    adapter = get_adapter(DeviceNetwork.AIRGRADIENT)
    print(f"get_adapter(AIRGRADIENT) → {type(adapter).__name__}")  # AirGradientAdapter

    adapter = get_adapter("unknown_network")
    print(f"get_adapter('unknown')  → {adapter}")  # None

    # --- fetch_from_adapter: one-call convenience wrapper ---
    device = {"device_number": 123456, "key": "YOUR_READ_API_KEY"}
    dates = [("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z")]

    result = fetch_from_adapter(DeviceNetwork.AIRQO, device, dates)
    print_result("fetch_from_adapter(AIRQO)", result)


# ---------------------------------------------------------------------------
# 9.  storage_registry.py — lightweight in-process storage registry
# ---------------------------------------------------------------------------
# A simple in-memory registry that maps string names to arbitrary storage
# backend objects (e.g. a BigQueryAdapter, a local cache, a mock).
# ---------------------------------------------------------------------------


def example_storage_registry():
    from airqo_etl_utils.sources.storage_registry import (
        register_storage,
        get_storage,
        get_default_storage,
    )
    from airqo_etl_utils.sources.bigquery_adapter import BigQueryAdapter

    bq = BigQueryAdapter()
    register_storage("bigquery", bq)

    # Retrieve by name
    backend = get_storage("bigquery")
    print(f"\nstorage_registry: get_storage('bigquery') → {type(backend).__name__}")

    # Retrieve the first registered backend (useful when only one is registered)
    default = get_default_storage()
    print(f"storage_registry: get_default_storage()    → {type(default).__name__}")


# ---------------------------------------------------------------------------
# Entry-point — run all examples that do not require live credentials
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(__doc__)

    # Section 7 (BigQuery) and all external-API examples require credentials;
    # run the registry and storage examples which need no network access.
    example_registry()
    example_storage_registry()

    # Uncomment the relevant example once credentials are available:
    # example_thingspeak()
    # example_iqair()
    # example_airgradient()
    # example_tahmo()
    # example_openweather()
    # example_nomads()
    # example_bigquery()
