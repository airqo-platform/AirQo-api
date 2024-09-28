import great_expectations as gx
from great_expectations.exceptions import DataContextError
from great_expectations.data_context.types.base import DataContextConfig
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

import os
from pathlib import Path
import numpy as np

from .airqo_gx_metrics import AirQoGxExpectations
from .config import configuration

from typing import Dict, Any, List


class AirQoGx:
    def __init__(
        self,
        datasource_name: str,
        data_asset_name: str,
        expectation_suite_name: str,
        checkpoint_name: str,
        expectations: Dict[str, Any],
        data_connector_name: str = "default_runtime_data_connector_name",
        execution_engine: str = "sql",
        dataframe=None,
        cloud_mode=False,
    ):
        """
        Class builds a context and bundles up all necessary bits i.e expectation suite and expectations, checkpoints and also provides a method to run a checkpoint returning the results of the validations.

        Args:
            datasource_name (str): A datasource represents a connection to a data store, such as a database, data warehouse, file system, or a cloud storage system.
            data_asset_name (str): Represents a collection of data that you want to validate, such as a specific table in a database or a file in a storage system.
            expectation_suite_name (str): Groups together multiple expectations that describe the desired characteristics of a dataset.
            checkpoint_name (str): A checkpoint is a reusable configuration in Great Expectations that bundles together the data source, data asset, expectation suite, and other options for a validation run.
            expectations (dict): Assertions about data, which define what the data should look like.
            data_connector_name (str): Defines how to connect to a specific data asset within a datasource.
            execution_engine (str): Component responsible for executing expectations against data. The execution engine can be based on different backend technologies, such as SQL for databases or Pandas for dataframes in memory.
            dataframe (pandas.DataFrame):
            cloud_mode (bool): Enables integration with Great Expectations Cloud.

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
        """

        self.datasource_name = datasource_name
        self.data_connector_name = data_connector_name
        self.data_asset_name = data_asset_name
        self.expectation_suite_name = expectation_suite_name
        self.checkpoint_name = checkpoint_name
        self.expectations = expectations
        self.execution_engine = execution_engine
        self.dataframe = dataframe
        self.project = configuration.GOOGLE_CLOUD_PROJECT_ID
        self.cloud_mode = cloud_mode
        self.data_checks_table = configuration.BIGQUERY_GX_RESULTS_TABLE

    def setup(self):
        """
        Set up the data source, expectation suite, and checkpoint.

        This method builds the data source, retrieves or creates the expectation suite,
        and adds or updates the expectations. It also creates or updates the checkpoint.
        """
        BASE_PATH = Path(__file__).resolve().parents[1]

        gx_dir = os.path.join(BASE_PATH, "include", "gx")

        data_context_config = DataContextConfig(
            config_version=3,
            stores={
                "expectations_store": {
                    "class_name": "ExpectationsStore",
                    "store_backend": {
                        "class_name": "TupleFilesystemStoreBackend",
                        "base_directory": gx_dir + "/expectations/",
                    },
                },
                "validations_store": {
                    "class_name": "ValidationsStore",
                    "store_backend": {
                        "class_name": "TupleFilesystemStoreBackend",
                        "base_directory": gx_dir + "/validations/",
                    },
                },
                "evaluation_parameter_store": {
                    "class_name": "EvaluationParameterStore",
                },
                "checkpoint_store": {
                    "class_name": "CheckpointStore",
                    "store_backend": {
                        "class_name": "TupleFilesystemStoreBackend",
                        "base_directory": gx_dir + "/checkpoints/",
                    },
                },
            },
            expectations_store_name="expectations_store",
            validations_store_name="validations_store",
            evaluation_parameter_store_name="evaluation_parameter_store",
            checkpoint_store_name="checkpoint_store",
            data_docs_sites={
                "local_site": {
                    "class_name": "SiteBuilder",
                    "store_backend": {
                        "class_name": "TupleFilesystemStoreBackend",
                        "base_directory": gx_dir + "/uncommitted/data_docs/local_site/",
                    },
                    "site_index_builder": {
                        "class_name": "DefaultSiteIndexBuilder",
                    },
                },
            },
        )
        self.context = gx.get_context(
            project_config=data_context_config,
            context_root_dir=gx_dir,
            cloud_mode=self.cloud_mode,
        )

        self.build_data_source()

        # Retrieve or create expectation suite
        try:
            expectation_suite = self.context.get_expectation_suite(
                self.expectation_suite_name
            )
            print(f"Expectation suite '{self.expectation_suite_name}' already exists.")
        except DataContextError:
            expectation_suite = self.context.add_expectation_suite(
                self.expectation_suite_name
            )
            print(f"Created new expectation suite '{self.expectation_suite_name}'.")

        self.context.save_expectation_suite(expectation_suite=expectation_suite)

        self.add_or_update_expectations()

        self.create_or_update_checkpoint()

    def add_or_update_expectations(self) -> None:
        """
        Add or update expectations in the given expectation suite.
        """

        gx_metrics = AirQoGxExpectations(self.expectation_suite_name)

        suite = self.context.get_expectation_suite(
            expectation_suite_name=self.expectation_suite_name
        )

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

                        suite.add_expectation(expectation_config)
                except Exception as e:
                    print(f"Error adding expectation for {expectation_type}: {e}")
            else:
                print(f"No method found for expectation type: {expectation_type}")

        self.context.add_or_update_expectation_suite(expectation_suite=suite)

    def build_data_source(self) -> None:
        match self.execution_engine:
            case "sql":
                self.data_source = self.context.sources.add_or_update_sql(
                    name=self.datasource_name,
                    connection_string="bigquery://" + self.project,
                    create_temp_table=False,
                )
            case "pandas":
                self.data_source = self.context.sources.add_or_update_pandas(
                    name=self.datasource_name
                )

    def create_or_update_checkpoint(self):
        """
        Create or update a Great Expectations checkpoint.

        This method builds a batchrequest based on the execution engine (SQL or Pandas),
        and configures a checkpoint in the Great Expectations context.

        Raises:
            ValueError: If the execution engine is 'pandas' and no DataFrame is provided.
        """

        def build_sql_query(data_asset_name: str):
            """
            Build a SQL query for the given project, dataset, and table. This is currently only configured for BigQuery

            Args:
                data_asset_name: This combines the project name, dataset name and table name. i.e project.dataset.table

            Returns:
                str: The constructed SQL query.
            """
            return f"""
            SELECT *
            FROM `{data_asset_name}`
            WHERE TIMESTAMP_TRUNC(timestamp, MONTH) = TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH)) LIMIT 1000
            """

        if self.execution_engine == "sql":
            query = build_sql_query(self.data_asset_name)

            self.data_source.add_query_asset(name=self.data_asset_name, query=query)
            data_asset = self.context.get_datasource(self.datasource_name).get_asset(
                self.data_asset_name
            )
        elif self.execution_engine == "pandas":
            if self.dataframe is None:
                raise ValueError(
                    "DataFrame must be provided for Pandas execution engine."
                )
            data_asset = self.data_source.add_dataframe_asset(
                name=self.data_asset_name, dataframe=self.dataframe
            )

        batch_request = data_asset.build_batch_request()

        checkpoint_config = {
            "name": self.checkpoint_name,
            "config_version": 1.0,
            "class_name": "SimpleCheckpoint",
            "run_name_template": "%Y%m%d-%H%M%S",
            "validations": [
                {
                    "batch_request": batch_request,
                    "expectation_suite_name": self.expectation_suite_name,
                }
            ],
        }

        self.context.add_or_update_checkpoint(**checkpoint_config)
        print(f"Checkpoint '{self.checkpoint_name}' created or updated.")

    def run(self):
        """
        Returns a dictionary of expectations, their results and meta data if any.
        """
        results = self.context.run_checkpoint(self.checkpoint_name)
        # Uncomment in local environment to open docs.
        self.context.build_data_docs(site_names=["local_site"])
        self.context.open_data_docs()
        return results

    def store_results_in_bigquery(
        self, validation_results: List[Dict[str, Any]]
    ) -> None:
        """
        Store the extracted validation results into BigQuery.

        Args:
            validation_results (list of dict): List of validation results to store.
            table_id (str): The BigQuery table ID where results will be stored.
        """
        client = bigquery.Client()
        table_id = self.data_checks_table
        # Define the schema for the BigQuery table
        schema = [
            bigquery.SchemaField("run_name", "STRING"),
            bigquery.SchemaField("run_time", "TIMESTAMP"),
            bigquery.SchemaField("run_result", "BOOLEAN"),
            bigquery.SchemaField("data_source", "STRING"),
            bigquery.SchemaField("data_asset", "STRING"),
            bigquery.SchemaField("column_name", "STRING"),
            bigquery.SchemaField("checkpoint_name", "STRING"),
            bigquery.SchemaField("expectation_suite", "STRING"),
            bigquery.SchemaField("expectation_type", "STRING"),
            bigquery.SchemaField("expectation_result", "BOOLEAN"),
            bigquery.SchemaField("raised_exception", "BOOLEAN"),
            bigquery.SchemaField("sample_space", "FLOAT"),
            bigquery.SchemaField("unexpected_count", "FLOAT"),
            bigquery.SchemaField("unexpected_percentage", "FLOAT"),
            bigquery.SchemaField("partial_unexpected_list", "STRING"),
            bigquery.SchemaField("missing_count", "FLOAT"),
            bigquery.SchemaField("missing_percent", "FLOAT"),
            bigquery.SchemaField("unexpected_percent_total", "FLOAT"),
            bigquery.SchemaField("unexpected_percent_nonmissing", "FLOAT"),
            bigquery.SchemaField("partial_unexpected_counts", "STRING"),
        ]

        try:
            client.get_table(table_id)
            print(f"Table {table_id} already exists.")
        except NotFound:
            print(f"Table {table_id} not found. Creating table.")
            table = bigquery.Table(table_id, schema=schema)
            client.create_table(table)
            print(f"Table {table_id} created.")

        errors = client.insert_rows_json(
            table_id, validation_results, row_ids=[None] * len(validation_results)
        )
        if errors:
            print(f"Encountered errors while inserting rows: {errors}")

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
        run_name = validation_result["validation_result"]["meta"]["run_id"].run_name
        run_time = validation_result["validation_result"]["meta"]["run_id"].run_time
        data_source = validation_result["validation_result"]["meta"][
            "active_batch_definition"
        ]["datasource_name"]
        data_asset = validation_result["validation_result"]["meta"][
            "active_batch_definition"
        ]["data_asset_name"]
        checkpoint_name = validation_result["validation_result"]["meta"][
            "checkpoint_name"
        ]
        expectation_suite = validation_result["validation_result"]["meta"][
            "expectation_suite_name"
        ]
        run_result = validation_result["validation_result"]["success"]
        # Not being used for at the moment
        # local_site = validation_result["actions_results"]["update_data_docs"][
        #     "local_site"
        # ]

        # Extract validation results
        for result in validation_result["validation_result"]["results"]:
            # Type ExpectationConfig
            expectation_type = result["expectation_config"]["expectation_type"]
            partial_unexpected_list = [
                "null" if np.isnan(x) else x
                for x in result["result"].get("partial_unexpected_list", [])
            ]

            partial_unexpected_counts = [
                {
                    "value": "null" if np.isnan(item["value"]) else item["value"],
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
