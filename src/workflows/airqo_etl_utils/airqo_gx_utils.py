from datetime import datetime, timezone
from typing import Dict, Any, List
import os
from pathlib import Path
import pandas as pd

import great_expectations as gx
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

from .airqo_gx_metrics import AirQoGxExpectations
from .config import configuration

import logging

logger = logging.getLogger("airflow.task")


class AirQoGx:
    def __init__(
        self,
        datasource_name: str,
        data_asset_name: str,
        expectation_suite_name: str,
        checkpoint_name: str,
        expectations: Dict[str, Any],
        execution_engine: str = "sql",
        dataframe=None,
    ):
        """
        Class builds a context and bundles up all necessary bits i.e expectation suite and expectations, checkpoints and also provides a method to run a checkpoint returning the results of the validations.

        Args:
            datasource_name (str): A datasource represents a connection to a data store, such as a database, data warehouse, file system, or a cloud storage system.
            data_asset_name (str): Represents a collection of data that you want to validate, such as a specific table in a database or a file in a storage system.
            expectation_suite_name (str): Groups together multiple expectations that describe the desired characteristics of a dataset.
            checkpoint_name (str): A checkpoint is a reusable configuration in Great Expectations that bundles together the data source, data asset, expectation suite, and other options for a validation run.
            expectations (dict): Assertions about data, which define what the data should look like.
            execution_engine (str): Component responsible for executing expectations against data. The execution engine can be based on different backend technologies, such as SQL for databases or Pandas for dataframes in memory.
            dataframe (pandas.DataFrame):

        Notes:
            There are two approaches to passing an expectation dict.
            1. Unique expectations can be passed normally in a dictionary i.e
                expectation = {
                    "expect_column_values_to_not_be_null":"tenant",
                    "expect_column_values_to_be_between":{"pm2_5":{"min_value":1, "max_value":100}},
                    "expect_column_value_lengths_to_equal":{"device_number":{"value":7}},
                    "expect_column_values_to_not_match_regex_list":{"device_id":{"regex_list":["^b.*", "^c.*"]}},
                    "expect_column_values_to_match_regex":{"device_id":{"regex":"^a.*"}}
                    }
            2. To apply the same expectation to multuple columns, the columns are added to a list as shown below:
                expectations = {
                    "expect_column_values_to_not_be_null": ["co2", "hcho", "tvoc", "timestamp"],
                    "expect_column_values_to_be_between": [
                        {"co2": {"min_value": 45.47, "max_value": 1445.23}},
                        {"tvoc": {"min_value": 0, "max_value": 120.55}},
                        {"hcho": {"min_value": 0, "max_value": 132.58}}
                        ]
                    }

        This method builds the data source, retrieves or creates the expectation suite,
        and adds or updates the expectations. It also creates or updates the checkpoint.
        Notes:
            - Overide project id from config/env
        """

        self.datasource_name = datasource_name
        self.data_asset_name = data_asset_name
        self.expectation_suite_name = expectation_suite_name
        self.checkpoint_name = checkpoint_name
        self.expectations = expectations
        self.execution_engine = execution_engine
        self.dataframe = dataframe
        self.project = configuration.GOOGLE_CLOUD_PROJECT_ID
        self.data_checks_table = configuration.BIGQUERY_GX_RESULTS_TABLE

    def setup(self):
        """
        Set up the data source, expectation suite, and checkpoint.

        This method builds the data source, creates or updates the expectation suite
        with its expectations, and creates or updates the checkpoint.

        The development environment keeps the Great Expectations project on disk under
        include/gx, which holds the Data Docs site. Every other environment keeps the
        project in memory.
        """
        if configuration.ENVIRONMENT == "development":
            BASE_PATH = Path(__file__).resolve().parents[1]
            self.context = gx.get_context(
                mode="file", project_root_dir=os.path.join(BASE_PATH, "include")
            )
        else:
            self.context = gx.get_context(mode="ephemeral")

        self.build_data_source()

        self.add_or_update_expectations()

        self.create_or_update_checkpoint()

    def add_or_update_expectations(self) -> None:
        """
        Add or update expectations in the given expectation suite.
        """

        gx_metrics = AirQoGxExpectations(self.expectation_suite_name)

        suite = gx.ExpectationSuite(name=self.expectation_suite_name)

        for expectation_type, expectation_list in self.expectations.items():
            if hasattr(gx_metrics, expectation_type):
                try:
                    expectation_method = getattr(gx_metrics, expectation_type)
                    if not isinstance(expectation_list, list):
                        expectation_list = [expectation_list]

                    for kwargs in expectation_list:
                        if isinstance(kwargs, dict):
                            if len(kwargs) == 1 and isinstance(
                                next(iter(kwargs.values())), dict
                            ):
                                column, params = next(iter(kwargs.items()))
                                expectation_config = expectation_method(
                                    column=column, **params
                                )
                            else:
                                expectation_config = expectation_method(**kwargs)
                        elif isinstance(kwargs, str):
                            expectation_config = expectation_method(column=kwargs)
                        else:
                            raise ValueError(
                                f"Unsupported format for expectation: {expectation_type}"
                            )

                        suite.add_expectation(expectation_config.to_domain_obj())
                except Exception as e:
                    logger.exception(
                        f"Error adding expectation for {expectation_type}: {e}"
                    )
            else:
                logger.warning(
                    f"No method found for expectation type: {expectation_type}"
                )

        self.suite = self.context.suites.add_or_update(suite)

    def build_data_source(self) -> None:
        """
        Configure and register the Great Expectations data source based on the
        specified execution engine (SQL or Pandas).

        Behavior:
            - For SQL: Uses a BigQuery connection string in the format:
            `"bigquery://<project_id>"`
            and disables creation of temporary tables.
            - For Pandas: Registers a simple in-memory data source.

        Raises:
            ValueError: If `execution_engine` is neither `"sql"` nor `"pandas"`.
        """
        match self.execution_engine:
            case "sql":
                # Seeded with poject id
                self.data_source = self.context.data_sources.add_or_update_sql(
                    name=self.datasource_name,
                    connection_string="bigquery://" + self.project,
                    create_temp_table=False,
                )
            case "pandas":
                self.data_source = self.context.data_sources.add_or_update_pandas(
                    name=self.datasource_name
                )

    def create_or_update_checkpoint(self):
        """
        Create or update a Great Expectations checkpoint.

        This method builds a batch definition based on the execution engine (SQL or Pandas),
        pairs it with the expectation suite in a validation definition, and configures a
        checkpoint in the Great Expectations context.

        Args:
            data_store: This combines the project name, dataset name and table name. i.e project.dataset

        Raises:
            ValueError: If the execution engine is 'pandas' and no DataFrame is provided.

        Notes:
            When the engine is 'sql', gx extracts the data from biquery. Currently dynamically set to the day before.
        """

        def build_sql_query(
            data_asset_name: str, start_date: str = None, end_date: str = None
        ):
            """
            Build a SQL query for the given project, dataset, and table. This is currently only configured for BigQuery

            Args:
                data_asset_name: This combines the project name, dataset name and table name. i.e project.dataset.table

            Returns:
                str: The constructed SQL query.
            """
            # TODO Make this more dynamic to allow filters
            return f"""
            SELECT *
            FROM `{data_asset_name}`
            WHERE timestamp >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), DAY)) AND timestamp < TIMESTAMP(CURRENT_DATE())
            """

        if self.execution_engine == "sql":
            query = build_sql_query(self.data_asset_name)

            data_asset = self.data_source.add_query_asset(
                name=self.data_asset_name, query=query
            )
            batch_definition = data_asset.add_batch_definition_whole_table(
                self.data_asset_name
            )
        elif self.execution_engine == "pandas":
            if self.dataframe is None:
                raise ValueError(
                    "DataFrame must be provided for Pandas execution engine."
                )
            data_asset = self.data_source.add_dataframe_asset(name=self.data_asset_name)
            batch_definition = data_asset.add_batch_definition_whole_dataframe(
                self.data_asset_name
            )

        validation_definition = self.context.validation_definitions.add_or_update(
            gx.ValidationDefinition(
                name=self.checkpoint_name, data=batch_definition, suite=self.suite
            )
        )

        self.checkpoint = self.context.checkpoints.add_or_update(
            gx.Checkpoint(
                name=self.checkpoint_name,
                validation_definitions=[validation_definition],
                result_format="SUMMARY",
            )
        )
        logger.info(f"Checkpoint '{self.checkpoint_name}' created or updated.")

    def run(self):
        """
        Returns a dictionary of expectations, their results and meta data if any.
        """
        run_time = datetime.now(timezone.utc)
        batch_parameters = (
            {"dataframe": self.dataframe} if self.execution_engine == "pandas" else None
        )
        results = self.checkpoint.run(
            batch_parameters=batch_parameters,
            run_id=gx.RunIdentifier(
                run_name=run_time.strftime("%Y%m%d-%H%M%S"), run_time=run_time
            ),
        )
        if configuration.ENVIRONMENT == "development":
            self.context.build_data_docs(site_names=["local_site"])
            self.context.open_data_docs()
        return results

    def store_results_in_bigquery(
        self, validation_results: List[Dict[str, Any]]
    ) -> None:
        """
        Store Great Expectations validation results into a BigQuery table.

        This function ensures that the target BigQuery table exists (creates it if missing), and then inserts the given validation results as rows.

        Each row represents the outcome of a single expectation within a validation run.

        Args:
            validation_results (list of dict): List of validation results to store.
            table_id (str): The BigQuery table ID where results will be stored. # Passed in constructor

        Raises:
            google.cloud.exceptions.GoogleCloudError: If BigQuery operations fail (e.g., missing permissions).
        """
        client = bigquery.Client()
        table_id = self.data_checks_table
        # Define the schema for the BigQuery table
        schema = [
            bigquery.SchemaField(
                "run_name", "STRING", description="Logical name of the validation run"
            ),
            bigquery.SchemaField(
                "run_time",
                "TIMESTAMP",
                description="UTC timestamp of validation execution",
            ),
            bigquery.SchemaField(
                "run_result", "BOOLEAN", description="Overall checkpoint success"
            ),  # success = 100% else failure
            bigquery.SchemaField(
                "data_source",
                "STRING",
                description="Connection string / data source URI",
            ),
            bigquery.SchemaField(
                "data_asset", "STRING", description="Target table/view for validation"
            ),
            bigquery.SchemaField(
                "column_name", "STRING", description="Column validated (if applicable)"
            ),
            bigquery.SchemaField(
                "checkpoint_name", "STRING", description="GX checkpoint name"
            ),
            bigquery.SchemaField(
                "expectation_suite", "STRING", description="GX expectation suite name"
            ),
            bigquery.SchemaField(
                "expectation_type", "STRING", description="GX expectation type"
            ),
            bigquery.SchemaField(
                "expectation_result",
                "BOOLEAN",
                description="Pass/Fail for this expectation",
            ),
            bigquery.SchemaField(
                "raised_exception",
                "BOOLEAN",
                description="Whether GX raised an exception",
            ),
            bigquery.SchemaField(
                "sample_space",
                "FLOAT",
                description="Number of rows considered in validation",
            ),
            bigquery.SchemaField(
                "unexpected_count",
                "FLOAT",
                description="Number of rows violating expectation",
            ),
            bigquery.SchemaField(
                "unexpected_percentage",
                "FLOAT",
                description="Percentage of violating rows",
            ),
            bigquery.SchemaField(
                "partial_unexpected_list",
                "STRING",
                description="Sample unexpected values",
            ),
            bigquery.SchemaField(
                "missing_count", "FLOAT", description="Number of missing values"
            ),
            bigquery.SchemaField(
                "missing_percent", "FLOAT", description="Percentage of missing values"
            ),
            bigquery.SchemaField(
                "unexpected_percent_total",
                "FLOAT",
                description="Unexpected % of all rows",
            ),
            bigquery.SchemaField(
                "unexpected_percent_nonmissing",
                "FLOAT",
                description="Unexpected % of non-null rows",
            ),
            bigquery.SchemaField(
                "partial_unexpected_counts",
                "STRING",
                description="Sample unexpected values + counts",
            ),
        ]

        try:
            client.get_table(table_id)
            logger.info(f"Table {table_id} already exists.")
        except NotFound:
            logger.exception(f"Table {table_id} not found. Creating table.")
            table = bigquery.Table(table_id, schema=schema)
            client.create_table(table)
            logger.info(f"Table didn't exist. Table with id {table_id} created.")

        errors = client.insert_rows_json(
            table_id, validation_results, row_ids=[None] * len(validation_results)
        )

        if errors:
            logger.error(
                f"Encountered errors while inserting validation rows: {errors}"
            )
        else:
            logger.info(
                f"Successfully inserted {len(validation_results)} validation rows into {table_id}."
            )

    def digest_validation_results(
        self, validation_result: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Extract relevant information from a validation result for storing.

        Args:
            validation_result (Dict[str, Any]): The validation result object from Great Expectations.

        Returns:
            list of dict: Extracted information from the validation results.
        """
        validation_info: List[Dict[str, Any]] = []

        # Extract metadata from the validation result
        run_name = validation_result["meta"]["run_id"].run_name
        run_time = validation_result["meta"]["run_id"].run_time
        data_source = validation_result["meta"]["active_batch_definition"][
            "datasource_name"
        ]
        data_asset = validation_result["meta"]["active_batch_definition"][
            "data_asset_name"
        ]
        checkpoint_name = self.checkpoint_name
        expectation_suite = validation_result["suite_name"]
        run_result = validation_result["success"]

        # Extract validation results
        for result in validation_result["results"]:
            # Type ExpectationConfig
            expectation_type = result["expectation_config"]["type"]
            partial_unexpected_list = [
                "null" if pd.isna(x) else x
                for x in result["result"].get("partial_unexpected_list", [])
            ]

            partial_unexpected_counts = [
                {
                    "value": "null" if pd.isna(item["value"]) else item["value"],
                    "count": item["count"],
                }
                for item in result["result"].get("partial_unexpected_counts", [])
            ]

            validation_info.append(
                {
                    "run_name": run_name,
                    "run_time": str(run_time),
                    "run_result": run_result,
                    "data_source": data_source,
                    "data_asset": data_asset,
                    "column_name": result["expectation_config"]["kwargs"].get(
                        "column", None
                    ),
                    "checkpoint_name": checkpoint_name,
                    "expectation_suite": expectation_suite,
                    "expectation_type": expectation_type,
                    "expectation_result": result["success"],
                    "raised_exception": result["exception_info"].get(
                        "raised_exception", True
                    ),
                    "sample_space": result["result"].get("element_count", 0),
                    "unexpected_count": result["result"].get("unexpected_count", 0),
                    "unexpected_percentage": result["result"].get(
                        "unexpected_percent", 0
                    ),
                    "partial_unexpected_list": partial_unexpected_list,
                    "missing_count": result["result"].get("missing_count", 0),
                    "missing_percent": result["result"].get("missing_count", 0),
                    "unexpected_percent_total": result["result"].get(
                        "unexpected_percent_total", 0
                    ),
                    "unexpected_percent_nonmissing": result["result"].get(
                        "unexpected_percent_nonmissing", 0
                    ),
                    "partial_unexpected_counts": partial_unexpected_counts,
                }
            )

        return validation_info
