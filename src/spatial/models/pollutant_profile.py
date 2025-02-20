from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import ee
from google.oauth2 import service_account

from configure import Config


class GetEnviromentProfile:
    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(
            credentials=service_account.Credentials.from_service_account_file(
                Config.CREDENTIALS,
                scopes=["https://www.googleapis.com/auth/earthengine"],
            ),
            project=Config.GOOGLE_CLOUD_PROJECT_ID,
        )

class GetLocationProfile:
    @staticmethod
    def initialize_earth_engine():
        pass

