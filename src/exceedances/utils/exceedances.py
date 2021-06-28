from datetime import datetime, timedelta
import pandas as pd
import requests
import urllib3
from dataclasses import dataclass
from config import configuration
import numpy as np

# disable tls/ssl warnings
urllib3.disable_warnings()


@dataclass
class Exceedances:
    standard: str
    pollutant: str
    n_values: int
    day: datetime
    values: np.ndarray
    first_value: np.dtype(int)
    last_value:  np.dtype(int)


class CalculateExceedances:

    def __init__(self, tenant, standard, day):
        self.tenant = tenant
        self.standard = standard
        self.day = day
        self.df = pd.DataFrame(self.flatten_records())

    def calculate_exceedance():
