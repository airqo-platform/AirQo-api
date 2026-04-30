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

    required_lcs_cols: List[str] = [
        "device_id",
        "timestamp",
        "s1_pm2_5",
        "s2_pm2_5",
        "s1_pm10",
        "s2_pm10",
    ]
    required_bam_cols_hourly: List[str] = [
        "device_id",
        "timestamp",
        "pm2_5",
        "temperature",
        "humidity",
    ]
    required_bam_cols_raw: List[str] = [
        "device_id",
        "timestamp",
        "realtime_conc",
        "short_time_conc",
        "hourly_conc",
        "temperature",
        "humidity",
    ]

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
        resolved = (
            countries
            if countries is not None
            else (configuration.CALIBRATION_COLLOCATED_DEVICES or {})
        )
        if not resolved:
            raise ValueError(
                "No collocated device configuration found. "
                "Set the CALIBRATION_COLLOCATED_DEVICES environment variable."
            )

        self.countries = resolved

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
        # lcs_df, bam_df = self._fetch_data(config) # Use bigquery extraction (default)

        lcs_df, bam_df = self._fetch_data_from_aggregator(
            config
        )  # Picks data from aggregator.

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
        """
        Pull raw LCS and BAM data via from data bigquery.
        This is faster but could have unintended biases due to clean up processes.
        """
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
            datatype=DataType.CONSOLIDATED,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.BAM,
            data_filter={"device_id": [ref_id]} if ref_id else None,
        )

        lcs_df = lcs_df[CalibrationPipeline.required_lcs_cols]
        bam_df = bam_df[
            CalibrationPipeline.required_bam_cols_raw
        ]  # Switch to required_bam_cols_hourly if using hourly data from bigquery.

        return lcs_df, bam_df

    def _fetch_data_from_aggregator(
        self, config: Dict[str, Any]
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Pull raw LCS and BAM data via from device cache.
        This gets you raw data in it's rawest form available.
        """
        lcs_ids: List[str] = config.get("lcs_devices", [])
        ref_id: Optional[str] = config.get("reference_device")

        lcs_df = DataUtils.extract_devices_data(
            device_ids=lcs_ids if lcs_ids else None,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            device_category=DeviceCategory.LOWCOST,
            resolution=Frequency.RAW,
            date_frequency="48H",  # chunk into daily ranges to avoid API timeouts
        )

        bam_df = DataUtils.extract_devices_data(
            device_ids=[ref_id] if ref_id else None,
            start_date_time=self.start_date,
            end_date_time=self.end_date,
            device_category=DeviceCategory.BAM,
            resolution=Frequency.RAW,
            date_frequency="48H",  # chunk into daily ranges to avoid API timeouts
        )

        lcs_df = DataUtils.clean_low_cost_sensor_data(
            data=lcs_df, device_category=DeviceCategory.LOWCOST, data_type=DataType.RAW
        )
        bam_df = DataUtils.clean_bam_data(
            data=bam_df, datatype=DataType.RAW, frequency=Frequency.RAW
        )

        lcs_df = lcs_df[CalibrationPipeline.required_lcs_cols]
        bam_df = bam_df[CalibrationPipeline.required_bam_cols_raw]
        return lcs_df, bam_df

    def _prepare_training_data(
        self,
        lcs_df: pd.DataFrame,
        bam_df: pd.DataFrame,
        config: Dict[str, Any],
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Preprocess, merge hourly, and select feature columns.

        Enforces an 80 % hourly-coverage gate before merging:

        * BAM data is checked first; if it covers less than 80 % of the
          expected hourly range a ``ValueError`` is raised to skip the country.
        * Primary LCS coverage is then checked; if it falls below the threshold
          the method tries each secondary device listed in ``lcs_devices`` and
          selects the one with the highest hourly coverage that still meets the
          threshold.  If none qualify, a ``ValueError`` is raised to skip.

        Uses only the selected LCS device's readings for feature engineering
        to avoid multicollinearity from duplicate sensors.
        """
        primary_lc_device: str = config.get("primary_lcs", "")
        tz_offset: int = int(config.get("tz_offset_hours", 0))
        bam_device_name: Optional[str] = config.get("reference_device")

        _MIN_COVERAGE = 0.8
        expected_hours = self._expected_hours()

        # 1. BAM sufficiency check
        bam_hours = self._unique_hours(bam_df)
        bam_coverage = bam_hours / expected_hours
        if bam_coverage < _MIN_COVERAGE:
            raise ValueError(
                f"BAM data for '{bam_device_name}' covers only {bam_hours}/{expected_hours} "
                f"hours ({bam_coverage:.0%}); need \u2265{_MIN_COVERAGE:.0%}. Skipping."
            )

        # 2. LCS sufficiency check – prefer primary, fall back to secondary
        all_lcs_devices: List[str] = config.get("lcs_devices", [])
        secondary_devices = [d for d in all_lcs_devices if d != primary_lc_device]

        if primary_lc_device and primary_lc_device in lcs_df["device_id"].unique():
            primary_df = lcs_df[lcs_df["device_id"] == primary_lc_device]
            primary_hours = self._unique_hours(primary_df)
            if primary_hours / expected_hours >= _MIN_COVERAGE:
                lcs_df = primary_df
            else:
                # Can be done more efficiently by precomputing hours/device, but this is clearer and the datasets are small.
                # TODO: optimize if this becomes a bottleneck.
                best_device: Optional[str] = None
                best_hours = 0
                for device_id in secondary_devices:
                    device_df = lcs_df[lcs_df["device_id"] == device_id]
                    device_hours = self._unique_hours(device_df)
                    if device_hours > best_hours:
                        best_hours = device_hours
                        best_device = device_id

                if best_device and best_hours / expected_hours >= _MIN_COVERAGE:
                    logger.warning(
                        "Primary LCS '%s' covers only %d/%d hours (%.0f%%); "
                        "falling back to secondary device '%s'.",
                        primary_lc_device,
                        primary_hours,
                        expected_hours,
                        (primary_hours / expected_hours) * 100,
                        best_device,
                    )
                    lcs_df = lcs_df[lcs_df["device_id"] == best_device]
                else:
                    logger.warning(
                        "Primary LCS '%s' and all secondary devices have insufficient "
                        "coverage for the requested date range. Skipping.",
                        primary_lc_device,
                    )
                    raise ValueError(
                        f"Primary LCS '{primary_lc_device}' covers only "
                        f"{primary_hours}/{expected_hours} hours "
                        f"({primary_hours / expected_hours:.0%}), and no secondary "
                        f"device meets the {_MIN_COVERAGE:.0%} threshold. Skipping."
                    )
        else:
            logger.warning(
                "Primary LCS device '%s' not found in data; using all devices for feature engineering.",
                primary_lc_device,
            )

        merged = CalibrationPreprocessor.build_wide_dataset(
            lcs_df,
            bam_df,
            device_col="device_id",
            bam_device_name=bam_device_name,
            tz_offset_hours=tz_offset,
        )

        if merged.empty:
            raise ValueError("No overlapping hourly data after preprocessing.")

        features = CalibrationPreprocessor.build_feature_columns(merged)
        return merged, features

    def _expected_hours(self) -> int:
        """Return the number of expected hourly slots between start_date and end_date."""
        delta = pd.Timestamp(self.end_date) - pd.Timestamp(self.start_date)
        return max(1, int(delta.total_seconds() / 3600))

    @staticmethod
    def _unique_hours(df: pd.DataFrame) -> int:
        """Return the number of distinct calendar hours present in *df*'s ``timestamp`` column."""
        return pd.to_datetime(df["timestamp"]).dt.floor("h").nunique()
