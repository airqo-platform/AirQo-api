"""End-to-end calibration model training pipeline.

Orchestrates data fetching, preprocessing, feature engineering,
and model training/deployment for each configured country.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from airqo_etl_utils.calibration.preprocessor import CalibrationPreprocessor
from airqo_etl_utils.calibration.trainer import CalibrationModelTrainer
from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import DeviceCategory, Frequency, DataType
from airqo_etl_utils.datautils import DataUtils

logger = logging.getLogger("airflow.task")


_NO_BUCKET = object()


class CalibrationPipeline:
    """Orchestrate calibration training for all configured country pairs.

    Each country entry in ``countries`` must have the shape::

        {
            "primary_lcs":    "LC_Device1",           # device_id of the leading LCS
            "lcs_devices":    ["LC_Device1", "LC_Device2"],
            "reference_device": "BAM_Device1",           # BAM device_id
            "tz_offset_hours": 1                      # optional, default 0
        }

    Args:
        start_date: ISO 8601 start datetime (e.g. ``"2025-01-01T00:00:00Z"``).
        end_date:   ISO 8601 end datetime.
        countries:  Override the ``CALIBRATION_COLLOCATED_DEVICES`` config.
        bucket_name: Override the ``CALIBRATION_MODELS_BUCKET`` config.
    """

    def __init__(
        self,
        start_date: str,
        end_date: str,
        countries: Optional[Dict[str, Dict]] = None,
        bucket_name: Optional[str] = _NO_BUCKET,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

        # Countries: if the caller provided an explicit value (including an
        # empty dict) we honour it and validate; otherwise fall back to
        # configuration.
        if countries is None:
            self.countries = configuration.CALIBRATION_COLLOCATED_DEVICES or {}
        else:
            # Explicitly provided value must be non-empty
            if not countries:
                raise ValueError(
                    "No collocated device configuration found. "
                    "Set the CALIBRATION_COLLOCATED_DEVICES environment variable."
                )
            self.countries = countries

        # Bucket: distinguish between 'not provided' (use configuration)
        # and an explicit None (treat as misconfiguration/error). The test
        # suite passes `bucket_name=None` to assert the explicit None path.
        if bucket_name is _NO_BUCKET:
            self.bucket_name = configuration.CALIBRATION_MODELS_BUCKET
        else:
            # Caller explicitly provided a value (possibly None)
            if bucket_name is None:
                raise ValueError(
                    "No calibration models bucket configured. "
                    "Set CALIBRATION_MODELS_BUCKET or pass a bucket_name."
                )
            self.bucket_name = bucket_name

    def run(self) -> Dict[str, Any]:
        """Run the full pipeline for every configured country.

        Returns:
            Mapping of ``country → metrics dict`` (or ``{"error": ...}`` on
            failure so other countries are always attempted).
        """
        results: Dict[str, Any] = {}
        for country, config in self.countries.items():
            logger.info("Starting calibration pipeline for '%s'", country)
            try:
                results[country] = self._run_country(country, config)
            except Exception as exc:
                logger.error(
                    "Calibration failed for '%s': %s", country, exc, exc_info=True
                )
                results[country] = {"error": str(exc)}
        return results

    def _run_country(self, country: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the pipeline for a single country: fetch → preprocess → feature engineer → train/deploy.
        """
        lcs_df, bam_df = self._fetch_data(config)

        if lcs_df.empty:
            raise ValueError(f"No LCS data returned for '{country}'.")
        if bam_df.empty:
            raise ValueError(f"No BAM data returned for '{country}'.")

        df, features = self._prepare_training_data(lcs_df, bam_df, config)

        if df.empty:
            raise ValueError(f"No training data after preprocessing for '{country}'.")
        if not features:
            raise ValueError(f"No usable feature columns found for '{country}'.")

        blob_name = f"calibration/{country.lower()}_pm2_5_cal_model.pkl"
        return CalibrationModelTrainer.train_and_deploy(
            df,
            country=country,
            features=features,
            target=CalibrationPreprocessor.BAM_PM_TARGET,
            bucket_name=self.bucket_name,
            blob_name=blob_name,
        )

    def _fetch_data(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Pull raw LCS and BAM data via from data bigquery."""
        lcs_ids: List[str] = config.get("lcs_devices", [])
        ref_id: Optional[str] = config.get("reference_device")

        lcs_df = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            frequency=Frequency.RAW,
            device_category=DeviceCategory.LOWCOST,
            data_filter={"device_id": lcs_ids} if lcs_ids else None,
        )

        bam_df = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            frequency=Frequency.RAW,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            device_category=DeviceCategory.BAM,
            data_filter={"device_id": [ref_id]} if ref_id else None,
        )

        return lcs_df, bam_df

    def _fetch_data_from_device_cache(
        self, config: Dict[str, Any]
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Pull raw LCS and BAM data via from device cache.
            Note: This method is currently unused but can be switched to in the future if bigquery performance becomes an issue.
            It relies on the device cache being populated with the relevant data, which is typically the case for recent time windows.
            Raises ValueError if no data is returned for either LCS or BAM, or if required columns are missing.
        """
        # Note: This fallback method is currently not performant for the full training window(3 months), but could be used for recent data or in testing.
        # TODO: Could be improved by parallelizing the LCS and BAM fetches, and/or by fetching all devices together and filtering in-memory.
        # Might also help to consider cleaning the data using ``DataUtils.clean_low_cost_sensor_data`` and ``DataUtils.clean_bam_data`` after fetching, to ensure consistent formatting and handle any missing columns or other issues early on.
        lcs_ids: List[str] = config.get("lcs_devices", [])
        ref_id: Optional[str] = config.get("reference_device")

        lcs_df = DataUtils.extract_devices_data(
            device_ids=lcs_ids if lcs_ids else None,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            device_category=DeviceCategory.LOWCOST,
            frequency=Frequency.RAW,
        )

        bam_df = DataUtils.extract_devices_data(
            device_ids=[ref_id] if ref_id else None,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            device_category=DeviceCategory.BAM,
            frequency=Frequency.RAW,
        )

        # Consider cleaning raw data after fetching, to ensure consistent formatting, removal of outliers and handle any missing columns or other issues early on.
        # lcs_df = DataUtils.clean_low_cost_sensor_data(data=lcs_df, device_category=DeviceCategory.LOWCOST, data_type=DataType.RAW)
        # bam_df = DataUtils.clean_bam_data(data=bam_df, datatype=DataType.AVERAGED, frequency=Frequency.HOURLY)

        return lcs_df, bam_df

    def _prepare_training_data(
        self,
        lcs_df: pd.DataFrame,
        bam_df: pd.DataFrame,
        config: Dict[str, Any],
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Preprocess, merge hourly, and select feature columns.

        Uses only the ``primary_lcs`` device's readings for feature
        engineering to avoid multicollinearity from duplicate sensors.
        """
        primary_lcs: Optional[str] = config.get("primary_lcs")
        tz_offset: int = int(config.get("tz_offset_hours", 0))

        if primary_lcs and "device_id" in lcs_df.columns:
            primary_df = lcs_df[lcs_df["device_id"] == primary_lcs]
            if primary_df.empty:
                logger.warning(
                    "Primary LCS '%s' not found in fetched data; "
                    "falling back to all LCS devices.",
                    primary_lcs,
                )
                primary_df = lcs_df
        else:
            primary_df = lcs_df

        processed_lcs = CalibrationPreprocessor.process_lcs(primary_df)
        processed_bam = CalibrationPreprocessor.process_bam(bam_df)

        merged = CalibrationPreprocessor.merge_hourly(
            lcs_df=processed_lcs,
            bam_df=processed_bam,
            tz_offset_hours=tz_offset,
        )

        features = CalibrationPreprocessor.build_feature_columns(merged)
        return merged, features
