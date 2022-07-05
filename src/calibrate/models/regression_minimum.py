import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

RF_MODEL_MIN = os.getenv('RF_MODEL_MIN', 'jobs/rf_model_min.pkl')

class Regression:
    """
        The class contains functionality for computing device calibrated values .
    """

    def __init__(self):
        """ initialize """
        self.rf_regressor = pickle.load(open(RF_MODEL_MIN, 'rb'))

    def compute_calibrated_val(self, average_pm, temperature, humidity):
        input_variables = pd.DataFrame([[average_pm, temperature, humidity]],
                                       columns=['average_pm', 'temperature', 'humidity'],
                                       dtype='float',
                                       index=['input'])

        calibrated_pm = self.rf_regressor.predict(input_variables)[0]

        return calibrated_pm


if __name__ == "__main__":
    calibrateInstance = Regression()
