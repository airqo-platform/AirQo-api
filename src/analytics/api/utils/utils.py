import os
from pathlib import Path
import json
from typing import Dict
import logging

logger = logging.getLogger(__name__)


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
            file_json = open(os.path.join(current_file, file_name_path))
        except FileNotFoundError as ex:
            file_json = open(os.path.join(current_file, file_name))
            logger.exception(f"Schema not found at {file_name_path}")

        return json.load(file_json)

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
