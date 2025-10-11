# TODO: Setup code coverage for tests
from unittest.mock import patch

import pytest

from api.utils.data_formatters import format_to_aqcsv
from conftest import mock_dataframe, mock_aqcsv_globals


# TODO: Review this test
@pytest.mark.parametrize("pollutants", ["pm2_5", "pm10"])
@pytest.mark.parametrize("frequency", ["hourly", "daily", "raw"])
@pytest.mark.xfail
def test_format_to_aqcsv(
    mock_aqcsv_globals, mock_dataframe, pollutants: list, frequency: str
):
    with patch.dict(
        "src.mymodule.BIGQUERY_FREQUENCY_MAPPER",
        mock_aqcsv_globals["BIGQUERY_FREQUENCY_MAPPER"],
    ), patch.dict(
        "src.mymodule.FREQUENCY_MAPPER", mock_aqcsv_globals["FREQUENCY_MAPPER"]
    ), patch.dict(
        "src.mymodule.AQCSV_QC_CODE_MAPPER", mock_aqcsv_globals["AQCSV_QC_CODE_MAPPER"]
    ), patch.dict(
        "src.mymodule.AQCSV_PARAMETER_MAPPER",
        mock_aqcsv_globals["AQCSV_PARAMETER_MAPPER"],
    ):
        assert format_to_aqcsv([], pollutants, frequency) == []

        result = format_to_aqcsv(mock_dataframe, pollutants, frequency)
        assert isinstance(result, list)
        assert "site_id" in result[0].keys()
        assert "datetime" in result[0].keys()
        assert "parameter" in result[0].keys()
        assert "duration" in result[0].keys()
        for pollutant in pollutants:
            assert f"value_{pollutant}" in result[0].keys()

        if frequency == "raw":
            assert (
                result[0]["qc"]
                == mock_aqcsv_globals["AQCSV_QC_CODE_MAPPER"]["estimated"]
            )
        else:
            assert (
                result[0]["qc"]
                == mock_aqcsv_globals["AQCSV_QC_CODE_MAPPER"]["averaged"]
            )

        if pollutant == "pm2_5":
            assert "value_pm2_5" in result[0].keys()
            assert "unit_pm2_5" in result[0].keys()
            assert "data_status_pm2_5" in result[0].keys()
