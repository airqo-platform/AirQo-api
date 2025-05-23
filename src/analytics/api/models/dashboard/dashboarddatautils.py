import pandas as pd
from typing import Dict, List, Any
from collections import defaultdict
from api.utils.pollutants.pm_25 import get_pollutant_category, PM_COLOR_CATEGORY


class DashboardDataUtils:
    def processd3data(self, dataframe: pd.DataFrame) -> List[Dict]:
        """
        Processes time-series sensor data.

        Args:
            dataframe(pd.DataFrame): DataFrame containing columns ['site_id', 'name', 'generated_name', 'value', 'time'].

        Returns:
            list: A list of dictionaries, each representing a resampled data point with site metadata.
        """
        dataframe["name"] = dataframe["site_name"]
        dataframe.rename(
            columns={
                "pm2_5": "value",
                "datetime": "time",
                "site_name": "generated_name",
            },
            inplace=True,
        )
        dataframe.drop(
            columns=[
                "pm2_5_calibrated_value",
                "device_name",
                "network",
                "timestamp",
                "frequency",
            ],
            inplace=True,
        )
        records = dataframe.to_dict(orient="records")
        return records

    def __destructure_pie_data(self, generated_data) -> List[List[Dict]]:
        """
        Transforms a list of dictionaries containing aggregated pie chart data into a flat,
        structured format suitable for visualization.

        Args:
            generated_data(list[dict]): A list where each dictionary represents data for one entity (e.g. a site), with a "name" key and multiple pollutant or category keys and their values.

        Returns:
            list[list[dict]]: A nested list where each inner list contains dictionaries with keys:
                            - "name": original name of the data group (e.g., site name)
                            - "category": the pollutant/category name
                            - "color": hex color code for the category (from PM_COLOR_CATEGORY)
                            - "value": the corresponding numerical value
        """
        result = []
        for data in generated_data:
            destructured = []
            name = data.pop("name")
            for key in data.keys():
                destructured.append(
                    {
                        "name": name,
                        "category": key,
                        "color": PM_COLOR_CATEGORY.get(key, "#808080"),
                        "value": data[key],
                    }
                )
            result.append(destructured)

        return result

    def d3_generate_pie_chart_data(
        self, records: List[Dict[str, Any]], pollutant
    ) -> List[List[Dict]]:
        """
        Function to generate pie_chart data
        Args:
            records (list): list of pollutant objects (dict)
            key (str): a dict key to obtain the pollutant value from the record
            pollutant (str): string representing the pollutant

        Returns: a dict containing the category count
        """

        def default_value():
            return {
                "Good": 0,
                "Moderate": 0,
                "UHFSG": 0,
                "Unhealthy": 0,
                "VeryUnhealthy": 0,
                "Hazardous": 0,
                "Other": 0,
                "Unknown": 0,
            }

        location_category_count = defaultdict(default_value)

        for record in records:
            value = record.get("value")
            name = record.get("name") or record.get("generated_name")
            category = get_pollutant_category(value, pollutant=pollutant)
            location_category_count[name][category] = (
                location_category_count[name][category] + 1
            )
            location_category_count[name]["name"] = name

        return self.__destructure_pie_data(location_category_count.values())
