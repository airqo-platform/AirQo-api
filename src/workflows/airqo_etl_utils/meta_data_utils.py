import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .constants import DeviceNetwork
from .datautils import DataUtils
from .data_validator import DataValidationUtils
from .weather_data_utils import WeatherDataUtils
from datetime import datetime, timezone
from typing import Optional
import ast


class MetaDataUtils:
    @staticmethod
    def extract_devices() -> pd.DataFrame:
        """
        Extracts and processes device information into a structured Pandas DataFrame.

        This function retrieves device data, selects relevant columns, and adds additional fields
        such as `name` and `last_updated` to enhance the dataset.

        Returns:
            pd.DataFrame: A DataFrame containing device information.
        """
        devices, _ = DataUtils.get_devices()
        devices["status"] = devices["status"].replace(
            {"deployed": True, "not deployed": False}
        )
        devices = devices[
            [
                "network",
                "status",
                "isActive",
                "latitude",
                "longitude",
                "site_id",
                "name",
                "device_number",
                "description",
                "device_manufacturer",
                "device_category",
            ]
        ]
        devices.rename(columns={"isActive": "active", "status": "deployed"})
        devices["device_id"] = devices["name"]
        devices["last_updated"] = datetime.now(timezone.utc)

        return devices

    @staticmethod
    def extract_airqlouds_from_api(
        network: Optional[DeviceNetwork] = None,
    ) -> pd.DataFrame:
        # Airclouds are deprecated.
        airqlouds = AirQoApi().get_airqlouds(network=network)
        airqlouds = [
            {**airqloud, **{"sites": ",".join(map(str, airqloud.get("sites", [""])))}}
            for airqloud in airqlouds
        ]

        return pd.DataFrame(airqlouds)

    @staticmethod
    def extract_grids_from_api(network: Optional[DeviceNetwork] = None) -> pd.DataFrame:
        """
        Retrieves grid data from the AirQo API and formats it into a Pandas DataFrame.

        This function fetches grids from the AirQo API, processes the site information by converting lists of site IDs into comma-separated strings, and returns a structured DataFrame.

        Args:
            network(Optional[DeviceNetwork]): The device network to filter grids by. If None, grids from all networks are retrieved.

        Returns:
            pd.DataFrame: A DataFrame containing the grid data, with site lists represented as comma-separated strings.
        """
        grids = AirQoApi().get_grids(network=network)
        grids = [
            {**grid, **{"sites": ",".join(map(str, grid.get("sites", [""])))}}
            for grid in grids
        ]

        return pd.DataFrame(grids)

    @staticmethod
    def extract_cohorts_from_api(
        network: Optional[DeviceNetwork] = None,
    ) -> pd.DataFrame:
        """
        Retrieves cohort data from the AirQo API and formats it into a Pandas DataFrame.

        This function fetches cohorts from the AirQo API, processes the device information by converting lists of device IDs into comma-separated strings, and returns a structured DataFrame.

        Args:
            network(Optional[DeviceNetwork]): The device network to filter cohorts by. If None, cohorts from all networks are retrieved.

        Returns:
            pd.DataFrame: A DataFrame containing the cohort data, with device lists represented as comma-separated strings.
        """
        cohorts = AirQoApi().get_cohorts(network=network)
        cohorts = [
            {**cohort, **{"devices": ",".join(map(str, cohort.get("devices", [""])))}}
            for cohort in cohorts
        ]

        return pd.DataFrame(cohorts)

    @staticmethod
    def merge_airqlouds_and_sites(data: pd.DataFrame) -> pd.DataFrame:
        merged_data = []
        data = data.dropna(subset=["sites", "id"])

        for _, row in data.iterrows():
            merged_data.extend(
                [
                    {
                        **{"airqloud_id": row["id"], "network": row["network"]},
                        **{"site_id": site},
                    }
                    for site in row["sites"].split(",")
                ]
            )

        return pd.DataFrame(merged_data)

    @staticmethod
    def merge_grids_and_sites(data: pd.DataFrame) -> pd.DataFrame:
        """
        Merges grid data with associated site IDs into a structured DataFrame.

        Args:
            data(pd.DataFrame): A DataFrame containing grid information, which must include columns for 'sites' (comma-separated site IDs) and 'id' (grid IDs).

        Returns:
            pd.DataFrame: A DataFrame with each row representing a unique combination of grid ID and site ID, along with the corresponding network information.
        """
        merged_data = []
        data = data.dropna(subset=["sites", "id"])

        for _, row in data.iterrows():
            merged_data.extend(
                [
                    {
                        **{"grid_id": row["id"], "network": row["network"]},
                        **{"site_id": site},
                    }
                    for site in row["sites"].split(",")
                ]
            )

        return pd.DataFrame(merged_data)

    @staticmethod
    def merge_cohorts_and_devices(data: pd.DataFrame) -> pd.DataFrame:
        """
        Merges cohort data with associated device IDs into a structured DataFrame.

        Args:
            data(pd.DataFrame): A DataFrame containing cohort information, which must include columns for 'devices' (comma-separated device IDs) and 'id' (cohort IDs).

        Returns:
            pd.DataFrame: A DataFrame with each row representing a unique combination of cohort ID and device ID, along with the corresponding network information.
        """
        merged_data = []
        data = data.dropna(subset=["devices", "id"])

        for _, row in data.iterrows():
            merged_data.extend(
                [
                    {
                        **{"cohort_id": row["id"], "network": row["network"]},
                        **{"device_id": device},
                    }
                    for device in row["devices"].split(",")
                ]
            )

        return pd.DataFrame(merged_data)

    @staticmethod
    def extract_sites(network: Optional[DeviceNetwork] = None) -> pd.DataFrame:
        """
        Extracts site information for a given device network and standardizes the data format.

        This function retrieves site data, selects relevant columns, renames certain fields
        for consistency, and adds a timestamp indicating when the data was last updated.

        Args:
            network (Optional[DeviceNetwork]): The device network to filter sites by. If None, data for all networks is retrieved.

        Returns:
            pd.DataFrame: A DataFrame containing the extracted site information with standardized columns.
        """
        sites = DataUtils.get_sites(network=network)
        sites = sites[
            [
                "network",
                "site_id",
                "latitude",
                "longitude",
                "approximate_latitude",
                "approximate_longitude",
                "name",
                "search_name",
                "location_name",
                "description",
                "city",
                "region",
                "country",
            ]
        ]

        sites.rename(
            columns={
                "search_name": "display_name",
                "site_id": "id",
                "location_name": "display_location",
            },
            inplace=True,
        )
        sites["last_updated"] = datetime.now(timezone.utc)

        return sites

    @staticmethod
    def extract_sites_meta_data(
        network: Optional[DeviceNetwork] = None,
    ) -> pd.DataFrame:
        """
        Extracts site metadata for a given device network and ensures the DataFrame
        contains all required columns based on the BigQuery schema.

        This function fetches site metadata from the data source, retrieves the expected
        column schema from BigQuery, fills in any missing columns, and returns a
        standardized DataFrame with only the necessary columns.

        Args:
            network (Optional[DeviceNetwork]): The device network to filter sites by. Defaults to None.

        Returns:
            pd.DataFrame: A DataFrame containing the extracted site metadata with the correct schema.
        """
        sites = DataUtils.get_sites(network=network)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.sites_meta_data_table)
        sites = DataValidationUtils.fill_missing_columns(data=sites, cols=cols)
        sites = sites[cols]
        return sites

    @staticmethod
    def update_nearest_weather_stations(
        network: Optional[DeviceNetwork] = None,
    ) -> None:
        """
        Updates the nearest weather stations for each site in the specified network.

        This function retrieves site data, determines the nearest weather stations for each site,
        and updates the site records with the retrieved weather station information.

        Args:
            network(Optional[DeviceNetwork]): The device network to filter sites by. If None, all sites are processed.

        Returns:
            None: This function updates site data in place and does not return a value.
        """
        airqo_api = AirQoApi()
        sites_data = DataUtils.get_sites(network=network)
        sites_data.rename(
            columns={
                "approximate_latitude": "latitude",
                "approximate_longitude": "longitude",
            },
            inplace=True,
        )

        updated_sites = WeatherDataUtils.get_nearest_weather_stations(sites_data)
        updated_sites = [
            {
                "site_id": site.get("site_id"),
                "network": site.get("network"),
                "weather_stations": ast.literal_eval(site.get("weather_stations")),
            }
            for site in updated_sites
        ]
        airqo_api.update_sites(updated_sites)

    @staticmethod
    def update_sites_distance_measures(network: Optional[DeviceNetwork] = None) -> None:
        """
        Updates site records with distance-related metadata based on their latitude and longitude.

        This function retrieves site data, fetches additional metadata for each site's coordinates and updates the site records with the obtained information.

        Args:
            network(Optional[DeviceNetwork]): The device network to filter sites by. If None, all sites are processed.

        Returns:
            None: This function updates site data in place and does not return a value.
        """
        airqo_api = AirQoApi()
        sites = DataUtils.get_sites(network=network)
        updated_sites = []
        for _, site in sites.iterrows():
            latitude = site.get("approximate_latitude", None)
            longitude = site.get("approximate_longitude", None)
            record = {
                "site_id": site.get("site_id", None),
                "network": site.get("network", None),
                "latitude": latitude,
                "longitude": longitude,
            }
            meta_data = airqo_api.get_meta_data(
                latitude=latitude,
                longitude=longitude,
            )

            if len(meta_data) != 0:
                updated_sites.append(
                    {
                        **meta_data,
                        **{"site_id": record["site_id"], "network": record["network"]},
                    }
                )

        airqo_api.update_sites(updated_sites)

    @staticmethod
    def refresh_airqlouds(network: DeviceNetwork) -> None:
        airqo_api = AirQoApi()
        airqlouds = airqo_api.get_airqlouds(network=network)

        for airqloud in airqlouds:
            airqo_api.refresh_airqloud(airqloud_id=airqloud.get("id"))

    @staticmethod
    def refresh_grids(network: DeviceNetwork) -> None:
        airqo_api = AirQoApi()
        grids = airqo_api.get_grids(network=network)

        for grid in grids:
            airqo_api.refresh_grid(grid_id=grid.get("id"))
