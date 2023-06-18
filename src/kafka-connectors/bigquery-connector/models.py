from dataclasses import dataclass, asdict
from typing import ClassVar

import pandas as pd

from config import Config


@dataclass
class AirQloudSite:
    tenant: str
    airqloud_id: str
    site_id: str

    table: ClassVar[str] = Config.AIRQLOUDS_SITES_TABLE

    def is_valid(self):
        return (self.airqloud_id is not None and self.airqloud_id.strip() != "") and (
            self.site_id is not None and self.site_id.strip() != ""
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class AirQloud:
    id: str
    name: str
    tenant: str

    id_field: ClassVar[str] = "id"
    table: ClassVar[str] = Config.AIRQLOUDS_TABLE

    def is_valid(self):
        return self.id is not None and self.id.strip() != ""

    def to_dataframe(self):
        return pd.DataFrame([asdict(self)])


@dataclass
class Site:
    id: str
    tenant: str
    name: str
    location: str
    display_name: str
    display_location: str
    description: str
    city: str
    region: str
    country: str
    latitude: float
    longitude: float
    approximate_latitude: float
    approximate_longitude: float
    approximate_longitude: float

    id_field: ClassVar[str] = "id"
    table: ClassVar[str] = Config.SITES_TABLE

    def is_valid(self):
        return self.id is not None and self.id.strip() != ""

    def to_dataframe(self):
        return pd.DataFrame([asdict(self)])


@dataclass
class Device:
    device_id: str
    tenant: str
    name: str
    description: str
    latitude: float
    longitude: float
    approximate_latitude: float
    approximate_longitude: float
    site_id: str
    device_number: int
    device_manufacturer: str
    device_category: str

    id_field: ClassVar[str] = "device_id"
    table: ClassVar[str] = Config.DEVICES_TABLE

    def is_valid(self):
        return self.device_id is not None and self.device_id.strip() != ""

    def to_dataframe(self):
        return pd.DataFrame([asdict(self)])
