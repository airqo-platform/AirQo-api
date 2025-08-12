import os
from pathlib import Path
import json
from typing import Dict

from config import BaseConfig
from api.utils.messages import RATE_LIMIT_ERROR
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask import jsonify

import logging

logger = logging.getLogger(__name__)


def ratelimit_response():
    return RATE_LIMIT_ERROR


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=BaseConfig.CACHE_REDIS_URL,
    default_limits=["100 per minute"],
)


class Utils:
    @staticmethod
    def load_schema(file_name: str) -> Dict:
        """
        Load a JSON schema file from the "schema" directory or the given file path.

        Args:
            file_name(str): The name of the schema file to load.

        Returns:
            Dict: The parsed JSON content of the schema file.

        Raises:
            FileNotFoundError: If the file is not found in either the "schema" directory or the given path.
        """
        current_file = Path(__file__).parent.parent.parent
        file_name_path = f"schemas/files/{file_name}"
        try:
            with open(os.path.join(current_file, file_name_path)) as file_json:
                return json.load(file_json)
        except FileNotFoundError as e:
            logger.exception(f"Schema not found at {file_name_path} - {e}")

    @staticmethod
    def table_name(table: str) -> str:
        """
        Wraps a fully-qualified BigQuery table name in backticks.

        This is useful when dynamically constructing SQL queries to ensure that the
        table name is correctly interpreted by BigQuery, especially if it contains
        special characters like dots (`.`).

        Args:
            table (str): Fully-qualified BigQuery table name in the form 'project.dataset.table'.

        Returns:
            str: The table name wrapped in backticks (e.g., '`project.dataset.table`').
        """
        return f"`{table}`"
