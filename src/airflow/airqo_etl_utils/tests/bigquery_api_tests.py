import pytest
from airqo_etl_utils.bigquery_api import BigQueryApi
from google.cloud import bigquery
import pandas as pd

class TestBigQueryApi:
    @pytest.fixture
    def mock_bigquery_client(self, mocker):
        # mock the bigquery client and its methods
        mock_client = mocker.Mock(spec=bigquery.Client)
        mock_query = mocker.Mock(spec=bigquery.QueryJob)
        mock_result = mocker.Mock(spec=bigquery.table.RowIterator) # use the correct spec for the result object
        mock_dataframe = mocker.Mock(spec=pd.DataFrame)

        # set the return values of the mocked methods
        mock_client.query.return_value = mock_query
        mock_query.result.return_value = mock_result
        mock_result.to_dataframe.return_value = mock_dataframe # mock the to_dataframe method and set its return value

        # return the mock client
        return mock_client

    @pytest.fixture
    def bigquery_api(self, monkeypatch, mock_bigquery_client):
        # create an instance of the BigQueryApi class with the mock client
        monkeypatch.setattr(bigquery, "Client", lambda: mock_bigquery_client)
        return BigQueryApi()

    def test_fetch_raw_readings(self, bigquery_api, mock_bigquery_client):
        # call the fetch_raw_readings method
        dataframe = bigquery_api.fetch_raw_readings()

        # assert that the query method was called with the expected query and config
        expected_query = f"""
            SELECT DISTINCT raw_device_data_table.timestamp
               AS
               timestamp, raw_device_data_table.device_id AS device_name, raw_device_data_table.s1_pm2_5 AS s1_pm2_5, raw_device_data_table.s2_pm2_5 AS s2_pm2_5
               FROM
               `{bigquery_api.raw_measurements_table}` AS raw_device_data_table
               WHERE
               DATE(timestamp) >= DATE_SUB(
                   CURRENT_DATE(), INTERVAL 7 DAY) 
                ORDER BY device_id, timestamp ASC
               """
        expected_config = bigquery.QueryJobConfig()
        expected_config.use_query_cache = True

        mock_bigquery_client.query.assert_called_once_with(expected_query, expected_config)

        # assert that the result and to_dataframe methods were called once
        mock_bigquery_client.query.return_value.result.assert_called_once()
        mock_bigquery_client.query.return_value.result.return_value.to_dataframe.assert_called_once()

        # assert that the dataframe was processed correctly
        assert isinstance(dataframe, pd.DataFrame)
        assert dataframe["timestamp"].dtype == "datetime64[ns]"
        assert dataframe.groupby(["device_name", pd.Grouper(key="timestamp", freq="H")]).mean(numeric_only=True).equals(dataframe.set_index(["device_name", "timestamp"]))
