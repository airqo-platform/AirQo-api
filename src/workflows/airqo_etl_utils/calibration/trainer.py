"""Calibration model training, evaluation, and GCS deployment.

Wraps ``sklearn.ensemble.RandomForestRegressor`` around the same
infrastructure used by ``ForecastModelTrainer`` (metrics, deployment
gating, GCS upload, MLflow tracking).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.utils.machine_learning.mlflow_tracker import MlflowTracker

logger = logging.getLogger("airflow.task")


class CalibrationModelTrainer:
    """Train RandomForest calibration models and deploy to GCS if better.

    Reuses the deployment-gating helpers from ``ForecastModelTrainer``
    (``_regression_metrics``, ``_prep_time_split``, ``_deploy_if_better``)
    so that only models that strictly beat R², MAE, *and* RMSE of the
    currently deployed artifact are written to the bucket.
    """

    DEFAULT_RF_PARAMS: Dict[str, Any] = {
        "n_estimators": 500,
        "max_depth": 20,
        "max_features": "sqrt",
        "bootstrap": True,
        "random_state": 42,
        "n_jobs": -1,
    }

    @staticmethod
    def _fit_rf(
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        params: Dict[str, Any],
    ) -> Tuple[RandomForestRegressor, Dict[str, float]]:
        """Fit a RandomForestRegressor and return the model + eval metrics.

        Args:
            X_train: Training feature matrix.
            y_train: Training target array.
            X_val: Validation feature matrix.
            y_val: Validation target array.
            params: Keyword arguments forwarded to ``RandomForestRegressor``.

        Returns:
            Tuple of (fitted model, metrics dict with mae/rmse/r2/n_train/n_val).
        """
        model = RandomForestRegressor(**params)
        model.fit(X_train, y_train)
        preds = model.predict(X_val)
        metrics = ForecastModelTrainer._regression_metrics(y_val, preds)
        metrics.update({"n_train": int(len(X_train)), "n_val": int(len(X_val))})
        return model, metrics

    @staticmethod
    def train_and_deploy(
        df: pd.DataFrame,
        *,
        country: str,
        features: List[str],
        target: str = "bam_pm",
        bucket_name: str,
        blob_name: str,
        rf_params: Optional[Dict[str, Any]] = None,
        test_fraction: float = 0.2,
        date_col: str = "timestamp",
    ) -> Dict[str, Any]:
        """Train a calibration model and deploy to GCS if it outperforms the incumbent.

        Steps:
        1. Chronological train/val split via ``ForecastModelTrainer._prep_time_split``.
        2. Fit ``RandomForestRegressor``.
        3. Compare new metrics against the deployed artifact; upload only if
           strictly better on R², MAE, and RMSE.
        4. Log the run to MLflow.

        Args:
            df: Feature-engineered DataFrame including the target column.
            country: Country label used for blob naming and MLflow tags.
            features: Feature column names.
            target: Name of the target column (default ``"bam_pm"``).
            bucket_name: GCS bucket for model storage.
            blob_name: Destination blob path inside the bucket.
            rf_params: Optional override for ``RandomForestRegressor`` kwargs.
            test_fraction: Fraction of rows reserved for validation.
            date_col: Column used for chronological splitting.

        Returns:
            Metrics dict extended with ``deployed`` (bool) and
            ``deployment_reason`` (str) keys.

        Raises:
            ValueError: Propagated from ``_prep_time_split`` when data is
                insufficient or columns are missing.
        """
        params = {**CalibrationModelTrainer.DEFAULT_RF_PARAMS, **(rf_params or {})}

        train_df, val_df = ForecastModelTrainer._prep_time_split(
            df,
            features=features,
            target=target,
            date_col=date_col,
            test_fraction=test_fraction,
        )

        X_train = train_df[features].values
        y_train = train_df[target].values
        X_val = val_df[features].values
        y_val = val_df[target].values

        model, metrics = CalibrationModelTrainer._fit_rf(
            X_train, y_train, X_val, y_val, params
        )

        artifact: Dict[str, Any] = {
            "kind": "calibration",
            "model": model,
            "features": features,
            "target": target,
            "country": country,
            "metrics": metrics,
            "params": params,
        }

        deployment = ForecastModelTrainer._deploy_if_better(
            bucket_name=bucket_name,
            artifact=artifact,
            blob_name=blob_name,
            new_metrics=metrics,
        )

        metrics["deployed"] = deployment["deployed"]
        metrics["deployment_reason"] = deployment["reason"]

        CalibrationModelTrainer._log_mlflow(
            country=country,
            model=model,
            params=params,
            metrics=metrics,
            deployment=deployment,
            input_example=val_df[features].head(5) if len(val_df) >= 5 else None,
        )

        logger.info(
            "Calibration training for %s — R²=%.3f MAE=%.2f RMSE=%.2f deployed=%s (%s)",
            country,
            metrics.get("r2", float("nan")),
            metrics.get("mae", float("nan")),
            metrics.get("rmse", float("nan")),
            deployment["deployed"],
            deployment["reason"],
        )

        return metrics

    @staticmethod
    def _log_mlflow(
        *,
        country: str,
        model: RandomForestRegressor,
        params: Dict[str, Any],
        metrics: Dict[str, Any],
        deployment: Dict[str, Any],
        input_example: Optional[pd.DataFrame],
    ) -> None:
        """Log a calibration training run to MLflow (best-effort, never raises)."""
        tracker = MlflowTracker(
            tracking_uri=configuration.MLFLOW_TRACKING_URI,
            registry_uri=configuration.MLFLOW_REGISTRY_URI,
            experiment_name=configuration.MLFLOW_CALIBRATION_EXPERIMENT_NAME,
            model_gating_enabled=configuration.MLFLOW_ENABLE_MODEL_GATING,
            enabled=True,
        )
        tracker.log_run(
            run_name=f"calibration-{country}",
            params=params,
            metrics=metrics,
            tags={
                "pipeline": "calibration",
                "country": country,
                "deployed": str(deployment["deployed"]).lower(),
                "decision_reason": deployment["reason"],
            },
            model=model,
            model_artifact_path="model",
            input_example=input_example,
        )
