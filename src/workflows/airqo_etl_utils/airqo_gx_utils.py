import great_expectations as gx
import os
from pathlib import Path
from .airqo_gx_metrics import AirQoGxExpectations
from .config import configuration


class AirQoGx:
    def __init__(
        self,
        datasource_name: str,
        data_asset_name: str,
        expectation_suite_name: str,
        checkpoint_name: str,
        expectations: dict,
        data_connector_name: str = "default_runtime_data_connector_name",
        execution_engine: str = "sql",
        dataframe=None,
    ):
        self.datasource_name = datasource_name
        self.data_connector_name = data_connector_name
        self.data_asset_name = data_asset_name
        self.expectation_suite_name = expectation_suite_name
        self.checkpoint_name = checkpoint_name
        self.expectations = expectations
        self.execution_engine = execution_engine
        self.dataframe = dataframe
        self.project = configuration.GOOGLE_CLOUD_PROJECT_ID

    def setup(self):
        """
        Set up the data source, expectation suite, and checkpoint.

        This method builds the data source, retrieves or creates the expectation suite,
        and adds or updates the expectations. It also creates or updates the checkpoint.
        """
        BASE_PATH = Path(__file__).resolve().parents[1]

        gx_dir = os.path.join(BASE_PATH, "include")
        print(gx_dir)
        self.context = gx.get_context(None, gx_dir)

        self.build_data_source()

        # Retrieve or create expectation suite
        try:
            expectation_suite = self.context.get_expectation_suite(
                self.expectation_suite_name
            )
            print(f"Expectation suite '{self.expectation_suite_name}' already exists.")
        except gx.exceptions.DataContextError:
            expectation_suite = self.context.add_expectation_suite(
                self.expectation_suite_name
            )
            print(f"Created new expectation suite '{self.expectation_suite_name}'.")

        self.context.save_expectation_suite(expectation_suite=expectation_suite)

        self.add_or_update_expectations()

        self.create_or_update_checkpoint()

        gx_metrics = AirQoGxExpectations(self.expectation_suite_name)

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
            WHERE TIMESTAMP_TRUNC(timestamp, MONTH) = TIMESTAMP(CURRENT_DATE()) LIMIT 1000
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
        # self.context.build_data_docs()
        # self.context.open_data_docs()
        return results
