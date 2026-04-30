"""Calibration model training, evaluation, and GCS deployment.

Wraps ``sklearn.ensemble.RandomForestRegressor`` around the same
infrastructure used by ``ForecastModelTrainer`` (metrics, deployment
gating, GCS upload, MLflow tracking).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastModelTrainer
from airqo_etl_utils.utils.machine_learning.mlflow_tracker import MlflowTracker


logger = logging.getLogger("airflow.task")

ModelType = Literal["rf", "lgbm", "auto"]


class CalibrationModelTrainer:
    """Train RandomForest calibration models and deploy to GCS if better.

    Reuses the deployment-gating helpers from ``ForecastModelTrainer``
    (``_regression_metrics``, ``_prep_time_split``, ``_deploy_if_better``)
    so that only models that strictly beat R², MAE, *and* RMSE of the
    currently deployed artifact are written to the bucket.
    """

    DEFAULT_RF_PARAMS: Dict[str, Any] = {
        "n_estimators": 1000,
        "max_depth": 50,
        "max_features": "sqrt",
        "bootstrap": True,
        "random_state": 46,
        "n_jobs": -1,
    }

    DEFAULT_LGB_PARAMS: Dict[str, Any] = {
        "n_estimators": 1000,
        "learning_rate": 0.001,
        "max_depth": 50,
        "min_child_samples": 7,
        "num_leaves": 63,
        "subsample": 0.8807341031742756,
        "random_state": 46,
        "n_jobs": -1,
        "verbosity": -1,
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
        metrics.update({"n_train": len(X_train), "n_val": len(X_val)})
        return model, metrics

    @staticmethod
    def _fit_lgbm(
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        params: Dict[str, Any],
        early_stopping_rounds: int = 50,
    ) -> Tuple[lgb.LGBMRegressor, Dict[str, float]]:
        """Fit a LGBMRegressor with early stopping and return the model + eval metrics.

        Args:
            X_train: Training feature matrix.
            y_train: Training target array.
            X_val: Validation feature matrix.
            y_val: Validation target array.
            params: Keyword arguments forwarded to ``LGBMRegressor``.
            early_stopping_rounds: Patience for early stopping.

        Returns:
            Tuple of (fitted model, metrics dict with mae/rmse/r2/n_train/n_val).
        """
        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[
                lgb.early_stopping(
                    stopping_rounds=early_stopping_rounds, verbose=False
                ),
                lgb.log_evaluation(period=0),
            ],
        )
        preds = model.predict(X_val)
        metrics = ForecastModelTrainer._regression_metrics(y_val, preds)
        metrics.update({"n_train": len(X_train), "n_val": len(X_val)})
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
        model_type: ModelType = "auto",
        rf_params: Optional[Dict[str, Any]] = None,
        lgbm_params: Optional[Dict[str, Any]] = None,
        test_fraction: float = 0.2,
        date_col: str = "timestamp",
    ) -> Dict[str, Any]:
        """Train a calibration model and deploy to GCS if it outperforms the incumbent.

        Steps:
        1. Chronological train/val split via ``ForecastModelTrainer._prep_time_split``.
        2. Fit one or both of RF / LightGBM on the same split.
           - ``"rf"``: only RandomForestRegressor.
           - ``"lgbm"``: only LightGBM.
           - ``"auto"`` (default): train both; select the one with lower MAE.
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
            model_type: Which model(s) to train — ``"rf"``, ``"lgbm"``, or
                ``"auto"`` to train both and select the better one.
            rf_params: Optional override for ``RandomForestRegressor`` kwargs.
            lgbm_params: Optional override for ``LGBMRegressor`` kwargs.
            test_fraction: Fraction of rows reserved for validation.
            date_col: Column used for chronological splitting.

        Returns:
            Metrics dict extended with ``deployed`` (bool),
            ``deployment_reason`` (str), and ``model_type`` (str) keys.

        Raises:
            ValueError: Propagated from ``_prep_time_split`` when data is
                insufficient or columns are missing.
        """

        X_train, X_val, y_train, y_val = train_test_split(
            df[features],
            df[target],
            test_size=test_fraction,
            random_state=44,
        )

        candidates: List[Tuple[str, Any, Dict[str, Any], Dict[str, Any]]] = []

        if model_type in ("rf", "auto"):
            params_rf = {
                **CalibrationModelTrainer.DEFAULT_RF_PARAMS,
                **(rf_params or {}),
            }
            model_rf, metrics_rf = CalibrationModelTrainer._fit_rf(
                X_train, y_train, X_val, y_val, params_rf
            )
            candidates.append(("rf", model_rf, metrics_rf, params_rf))

        if model_type in ("lgbm", "auto"):
            params_lgbm = {
                **CalibrationModelTrainer.DEFAULT_LGB_PARAMS,
                **(lgbm_params or {}),
            }
            model_lgbm, metrics_lgbm = CalibrationModelTrainer._fit_lgbm(
                X_train, y_train, X_val, y_val, params_lgbm
            )
            candidates.append(("lgbm", model_lgbm, metrics_lgbm, params_lgbm))

        best_label, model, metrics, params = min(
            candidates, key=lambda c: c[2].get("mae", float("inf"))
        )
        metrics["model_type"] = best_label

        if model_type == "auto":
            logger.info(
                "Auto-select for %s: chose '%s' (MAE rf=%.3f lgbm=%.3f)",
                country,
                best_label,
                candidates[0][2].get("mae", float("nan")),
                candidates[1][2].get("mae", float("nan")),
            )

        artifact: Dict[str, Any] = {
            "kind": "calibration",
            "model_type": best_label,
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
            model_type=best_label,
            params=params,
            metrics=metrics,
            deployment=deployment,
            input_example=X_val.head(5) if not X_val.empty else None,
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
        model: Union[RandomForestRegressor, lgb.LGBMRegressor],
        model_type: str,
        params: Dict[str, Any],
        metrics: Dict[str, Any],
        deployment: Dict[str, Any],
        input_example: Optional[pd.DataFrame] = None,
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
                "model_type": model_type,
                "deployed": str(deployment["deployed"]).lower(),
                "decision_reason": deployment["reason"],
            },
            model=model,
            model_artifact_path="model",
            input_example=input_example,
        )
