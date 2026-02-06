from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
import cdsapi
import netCDF4 as nc
from pathlib import Path
import zipfile
import tempfile

import ee
import numpy as np
import pandas as pd
import xarray as xr
from google.oauth2 import service_account

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import DeviceNetwork
import logging

logger = logging.getLogger("airflow.task")


class SatelliteUtils:
    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(
            credentials=service_account.Credentials.from_service_account_file(
                configuration.GOOGLE_APPLICATION_CREDENTIALS,
                scopes=["https://www.googleapis.com/auth/earthengine"],
            ),
            project=configuration.GOOGLE_CLOUD_PROJECT_ID,
        )

    @staticmethod
    def extract_data_for_image(image: ee.Image, aoi: ee.Geometry.Point) -> ee.Feature:
        return ee.Feature(
            None,
            image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=1113.2,  # TODO: Review this, possibly a need for custom scales.
            ).set("date", image.date().format("YYYY-MM-dd")),
        )

    @staticmethod
    def get_satellite_data(
        aoi: ee.Geometry.Point,
        collection: str,
        fields: List[str],
        start_date: datetime,
        end_date: datetime,
    ) -> ee.FeatureCollection:
        return (
            ee.ImageCollection(collection)
            .filterDate(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            .filterBounds(aoi)
            .select(fields)
            .map(lambda image: SatelliteUtils.extract_data_for_image(image, aoi))
        )

    @staticmethod
    def process_time_series(
        time_series: Dict[str, Any], fields: List[str]
    ) -> Dict[str, Dict[str, List[float]]]:
        daily_data = {}
        for feature in time_series["features"]:
            date = feature["properties"]["date"]
            if date not in daily_data:
                daily_data[date] = {field: [] for field in fields}
            for field in fields:
                if field in feature["properties"]:
                    daily_data[date][field].append(feature["properties"][field])
        return daily_data

    @staticmethod
    def calculate_daily_means(
        daily_data: Dict[str, Dict[str, List[float]]], fields: List[str], city: str
    ) -> List[Dict[str, Any]]:
        results = []
        for date, data in daily_data.items():
            result = {
                "timestamp": datetime.strptime(date, "%Y-%m-%d").replace(
                    hour=0, minute=0, second=0, microsecond=0
                ),
                "city": city,
            }
            for field in fields:
                if data[field]:
                    result[field] = sum(filter(None, data[field])) / len(data[field])
                else:
                    result[field] = None
            results.append(result)
        return results

    @staticmethod
    def extract_data_for_location(
        location: Dict[str, Any],
        collections: Dict[str, List[str]],
        start_date: datetime,
        end_date: datetime,
    ) -> List[Dict[str, Any]]:
        aoi = ee.Geometry.Point(location["coords"])
        all_data = []

        for collection, fields in collections.items():
            prefixed_fields = [f"{collection}_{field}" for field in fields]
            satellite_data = SatelliteUtils.get_satellite_data(
                aoi, collection, fields, start_date, end_date
            )
            time_series = satellite_data.getInfo()
            daily_data = SatelliteUtils.process_time_series(time_series, fields)
            prefixed_daily_data = {
                date: {
                    f"{collection}_{field}": values for field, values in data.items()
                }
                for date, data in daily_data.items()
            }
            all_data.extend(
                SatelliteUtils.calculate_daily_means(
                    prefixed_daily_data, prefixed_fields, location["city"]
                )
            )

        return all_data

    @staticmethod
    def extract_satellite_data(
        locations: List[Dict[str, Any]],
        start_date: datetime,
        end_date: datetime,
        satellite_collections: Dict[str, List[str]],
    ) -> pd.DataFrame:
        SatelliteUtils.initialize_earth_engine()
        all_data = []
        for location in locations:
            all_data.extend(
                SatelliteUtils.extract_data_for_location(
                    location, satellite_collections, start_date, end_date
                )
            )
        all_data = pd.DataFrame(all_data)

        df_fixed = all_data.groupby(["timestamp", "city"]).agg(
            lambda x: x.dropna().iloc[0] if len(x.dropna()) > 0 else np.nan
        )

        df_fixed.columns = df_fixed.columns.str.lower()
        df_fixed.columns = [
            c.replace("/", "_").replace(" ", "_").lower() for c in df_fixed.columns
        ]

        return df_fixed

    @staticmethod
    def retrieve_cams_variable(variable_name: str, output_zip_path: str) -> None:
        """
        Downloads atmospheric composition forecast data for a specified variable from the CAMS (Copernicus Atmosphere Monitoring Service) using the CDS API.

        Args:
            variable_name(str): The name of the atmospheric variable to retrieve (e.g. 'pm10', 'pm2p5', etc.).
            output_zip_path(str): The local file path where the downloaded NetCDF ZIP file will be saved.

        Raises:
            Exception: If the data retrieval fails, an exception is raised with a message including the variable name and the underlying error.
        """
        try:
            cams_api = cdsapi.Client()
            today = datetime.today()
            yesterday = today - timedelta(days=1)
            date_range = f"{yesterday:%Y-%m-%d}/{today:%Y-%m-%d}"
            latest_time = (
                "0"
                if (hour_val := datetime.now(timezone.utc).hour % 12) == 0
                else str(hour_val)
            )
            request_payload = {
                "date": date_range,
                "type": "forecast",
                "format": "netcdf_zip",
                "leadtime_hour": [latest_time],
                "time": ["00:00", latest_time],
                "variable": variable_name,
                # 'area':[46.07, -57.13, -45.83, 121.46],
            }
            cams_api.retrieve(
                "cams-global-atmospheric-composition-forecasts",
                request_payload,
                output_zip_path,
            )
        except Exception as e:
            raise Exception(f"Failed to download {variable_name}: {e}")

    @staticmethod
    def process_netcdf(zip_file_path: str, variable_short_name: str) -> pd.DataFrame:
        """
        Processes a NetCDF file contained within a ZIP archive.
        It extracts the ZIP, reads specified variables, performs data transformations,
        and returns an xarray Dataset along with the path to the temporary directory.

        Args:
            zip_file_path (str): The path to the input ZIP file.
            variable_short_name (str): The short name of the variable to extract and process
                                       (e.g., 'PM25', 'O3').

        Returns:
            Tuple[pandas.DataFrame, str]: A tuple containing:
                - pandas.DataFrame: The processed Dataset.
                - str: The path to the temporary directory where files were extracted.
        Raises:
            FileNotFoundError: If the ZIP file does not exist or no .nc files are found inside it.
            zipfile.BadZipFile: If the provided zip_file_path is not a valid ZIP archive.
            KeyError: If a required variable is not found in the NetCDF file.
            ValueError: If the variable data has an unexpected shape or other data processing issues occur.
            Exception: For any other unforeseen errors during processing.
        """
        # Use TemporaryDirectory for automatic cleanup of the extracted files
        with tempfile.TemporaryDirectory() as temp_dir:
            extract_dir = Path(temp_dir)
            try:
                with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
                    zip_ref.extractall(extract_dir)
                logger.info(
                    f"Successfully extracted '{zip_file_path}' to '{extract_dir}'"
                )

                nc_files: List[Path] = list(extract_dir.glob("*.nc"))
                if not nc_files:
                    logger.error(
                        f"No .nc files found in extracted directory: {extract_dir}"
                    )
                    raise FileNotFoundError(
                        f"No .nc files found in '{zip_file_path}' after extraction."
                    )

                file_path: Path = nc_files[0]
                (
                    longitude,
                    latitude,
                    valid_time,
                    variable_data,
                ) = SatelliteUtils._read_netcdf_variables(
                    file_path, variable_short_name
                )

                # Create xarray Dataset
                ds: xr.Dataset = xr.Dataset(
                    {
                        variable_short_name: (
                            ["time", "latitude", "longitude"],
                            variable_data,
                        )
                    },
                    coords={
                        "longitude": longitude,
                        "latitude": latitude,
                        "time": valid_time,
                    },
                )
                logger.info(f"Initial xarray Dataset created with shape: {ds.dims}")

                # Further xarray transformations
                # Resample time to daily maximum and remove singleton dimensions
                ds = ds.resample(time="1D").max()
                ds = ds.squeeze(
                    drop=True
                )  # Removes dimensions of size 1 (e.g., if height dim becomes 1)
                logger.info(f"Dataset after resampling and squeezing: {ds.dims}")

                # Convert units from kg/m³ to µg/m³ (assuming this is always needed)
                # 1 kg = 1e9 µg
                ds[variable_short_name] *= 1e9
                df = ds.to_dataframe().reset_index()
                df.columns = [col.lower() for col in df.columns]
                return df

            except FileNotFoundError as fnf_e:
                logger.error(f"File not found error: {fnf_e}")
                raise
            except zipfile.BadZipFile as bzf_e:
                logger.error(f"Bad ZIP file error for '{zip_file_path}': {bzf_e}")
                raise
            except KeyError as ke_e:
                logger.error(f"Missing variable error: {ke_e}")
                raise
            except ValueError as ve_e:
                logger.error(f"Data processing error: {ve_e}")
                raise
            except Exception as e:
                logger.exception(
                    f"An error occurred while processing '{zip_file_path}'."
                )
                raise

    @staticmethod
    def clean_netcdf_data(data: List[pd.DataFrame]) -> pd.DataFrame:
        """
        Cleans and merges two NetCDF-derived pandas DataFrames by performing the following steps:

        Parameters:
            data(List[pd.DataFrame]): A list containing exactly two pandas DataFrames to be merged and cleaned.

        Returns:
            pd.DataFrame: A cleaned, merged DataFrame with averaged values grouped by time and location.
        """
        if len(data) != 2:
            raise ValueError("Expected a list of two DataFrames.")

        df1, df2 = data
        merged_df = pd.merge(df1, df2, on=["time", "latitude", "longitude"])

        merged_df[["latitude", "longitude"]] = merged_df[
            ["latitude", "longitude"]
        ].round(6)
        existing_cols = list(set(merged_df.columns) & {"pm10", "pm2p5"})

        if existing_cols:
            merged_df[existing_cols] = merged_df[existing_cols].round(4)

        merged_df.rename(columns={"pm2p5": "pm2_5", "time": "timestamp"}, inplace=True)

        return merged_df.groupby(
            ["timestamp", "latitude", "longitude"], as_index=False
        ).mean()

    def _read_netcdf_variables(
        file_path: Path, variable_short_name: str
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Reads essential variables (longitude, latitude, valid_time, and the specified data variable) from a NetCDF file, performs necessary data cleaning and reshaping.

        Args:
            file_path(Path): The path to the NetCDF file.
            variable_short_name(str): The short name of the variable to extract (e.g., 'PM25').

        Returns:
            Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]: A tuple containing (longitude, latitude, valid_time, variable_data) as NumPy arrays.

        Raises:
            KeyError: If a required variable .i.e (longitude, latitude, valid_time) is not found in the NetCDF file.
            ValueError: If 'variable_data' has an unexpected shape (not 4D).
        """
        with nc.Dataset(file_path) as dataset:
            # Check for essential variables
            required_vars = ["longitude", "latitude", "valid_time", variable_short_name]
            for var in required_vars:
                if var not in dataset.variables:
                    logger.error(
                        f"Required variable '{var}' not found in NetCDF file: {file_path.name}"
                    )
                    raise KeyError(
                        f"Required variable '{var}' not found in NetCDF file."
                    )

            # Extract data
            longitude: np.ndarray = dataset.variables["longitude"][:]
            latitude: np.ndarray = dataset.variables["latitude"][:]
            valid_time: np.ndarray = dataset.variables["valid_time"][:]
            variable_data: np.ndarray = dataset.variables[variable_short_name][:]

            # --- Data Transformations ---
            # Fix longitude values from 0-360 to -180-180
            longitude = np.where(longitude > 180, longitude - 360, longitude)

            # Reshape valid_time if it's 2D (e.g., (1, X) or (X, 1)) to 1D
            if len(valid_time.shape) == 2:
                valid_time = valid_time.reshape(-1)
            elif len(valid_time.shape) != 1:
                logger.warning(
                    f"'valid_time' has unexpected shape: {valid_time.shape}. Attempting to proceed."
                )

            # Convert numerical time to datetime objects
            time_units: str = dataset.variables["valid_time"].units
            valid_time = nc.num2date(valid_time, units=time_units)

            # Reshape variable_data from 4D to 3D if necessary
            # Assuming a structure like (time_dim, height_dim, lat_dim, lon_dim)
            # and we want (time_dim, lat_dim, lon_dim)
            if len(variable_data.shape) == 4:
                # Assuming the second dimension (index 1) is a height/level dimension to be squeezed
                # The .squeeze() operation might be a more general solution -- TODO followup
                # but explicit reshape is used here to match original logic.
                variable_data = variable_data.reshape(
                    -1, variable_data.shape[2], variable_data.shape[3]
                )
            elif len(variable_data.shape) != 3:  # Expecting 3D after potential reshape
                logger.error(
                    f"Variable '{variable_short_name}' has an unsupported shape after initial processing: {variable_data.shape}"
                )
                raise ValueError(
                    f"Variable '{variable_short_name}' has an unsupported shape. Expected 3D or 4D convertible to 3D."
                )

        return longitude, latitude, valid_time, variable_data

    @staticmethod
    def process_nomads_data_files(file: str) -> pd.DataFrame:
        """
        Processes a GRIB2 file downloaded from the NOMADS server and extracts wind speed and direction, adjusting longitude range to -180:180.

        Workflow:
        - Loads the file using xarray and cfgrib engine.
        - Normalizes longitudes from 0-360 to -180-180.
        - Calculates wind speed and direction from U and V components.
        - Converts to a DataFrame, rounds values, and groups by timestamp and location.

        Args:
            file(str): Path to the local GRIB2 file.

        Returns:
            pd.DataFrame: Processed and grouped DataFrame with columns: [`timestamp`, `latitude`, `longitude`, `wind_speed`, `wind_direction`]
        """
        logger.info(f"Processing GRIB2 file: {file}")
        try:
            # Open the GRIB2 file with xarray
            ds = xr.open_dataset(file, engine="cfgrib")

            # Shift longitudes from 0:360 to -180:180
            ds = ds.assign_coords(longitude=(((ds.longitude + 180) % 360) - 180))
            ds = ds.sortby("longitude")  # Ensure ascending order

            # Compute wind speed and direction
            u10, v10 = ds["u10"], ds["v10"]
            wind_speed = np.sqrt(u10**2 + v10**2)
            wind_direction = (270 - np.rad2deg(np.arctan2(v10, u10))) % 360

            # Add computed variables to dataset
            ds["wind_speed"] = wind_speed
            ds["wind_direction"] = wind_direction

            # Convert to DataFrame and reset index
            df = ds[["wind_speed", "wind_direction"]].to_dataframe().reset_index()

            # Keep only relevant columns
            df = df[["time", "latitude", "longitude", "wind_speed", "wind_direction"]]
            df.rename(columns={"time": "timestamp"}, inplace=True)

            # Round numerical values for consistency
            df[["latitude", "longitude"]] = df[["latitude", "longitude"]].round(6)
            df[["wind_speed", "wind_direction"]] = df[
                ["wind_speed", "wind_direction"]
            ].round(4)

            df = df.groupby(
                ["timestamp", "latitude", "longitude"], as_index=False
            ).mean()

            logger.info(
                f"Processed {len(df)} records from GRIB2 file. Preview:\n{df.head()}"
            )
            return df
        except Exception as e:
            logger.error(f"Error processing GRIB2 file: {e}")
            raise

    @staticmethod
    def approximate_satellite_data_locations_for_airquality_measurements(
        start_date: str, end_date: str
    ) -> pd.DataFrame:
        """
        Computes closest latitude and longitude approximations for satellite data points.
        Args:
            start_date (str): The start date for filtering records (format: 'YYYY-MM-DD').
            end_date (str): The end date for filtering records (format: 'YYYY-MM-DD').
        Returns:
            pd.DataFrame: DataFrame containing timestamp, latitudes and longitudes and airquality measurements.
        """
        sql_path = Path(__file__).parent / "sql" / "satellite" / "merged_hourly.sql"
        if not sql_path.exists():
            raise FileNotFoundError(f"SQL template not found: {sql_path}")

        sql_template = sql_path.read_text(encoding="utf-8")
        query = sql_template.format(
            geo_table=configuration.BIGQUERY_GEO_CONTINENT_META_DATA_TABLE,
            sat_table=configuration.BIGQUERY_SATELLITE_COPERNICUS_RAW_EVENTS_TABLE,
            start_date=start_date,
            end_date=end_date,
            distance_meters=100,
        )
        from airqo_etl_utils.storage import get_configured_storage

        storage_adapter = get_configured_storage()

        if storage_adapter is None:
            raise RuntimeError(
                "No configured storage adapter available; set STORAGE_BACKEND or check configuration"
            )

        try:
            logger.info(
                "Starting download of satellite data approximations from BigQuery."
            )
            data = storage_adapter.download_query(query)
            logger.info(f"Downloaded {len(data)} records from BigQuery.")
        except Exception as e:
            logger.error(f"Error downloading data from BigQuery: {e}")
            raise

        if data.empty:
            logger.info("No data found for the specified date range.")
            return pd.DataFrame(
                columns=[
                    "country",
                    "city",
                    "latitude",
                    "longitude",
                    "pm2_5",
                    "pm10",
                    "wind_speed",
                    "wind_direction",
                    "timestamp",
                    "data_type",
                ]
            )
        data["data_type"] = "FORECAST"
        data["network"] = DeviceNetwork.COPERNICUS.str
        return data
