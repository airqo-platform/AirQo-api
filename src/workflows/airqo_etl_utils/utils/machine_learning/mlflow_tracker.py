from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import mlflow
import pandas as pd

logger = logging.getLogger("airflow.task")


class MlflowTracker:
    """Reusable MLflow helper for model training runs."""

    def __init__(
        self,
        *,
        tracking_uri: Optional[str] = None,
        registry_uri: Optional[str] = None,
        experiment_name: Optional[str] = None,
        model_gating_enabled: bool = False,
        enabled: bool = True,
    ):
        self.enabled = enabled
        self.model_gating_enabled = model_gating_enabled
        if not self.enabled:
            return

        try:
            if tracking_uri:
                mlflow.set_tracking_uri(tracking_uri)
            if registry_uri:
                mlflow.set_registry_uri(registry_uri)
            if experiment_name:
                mlflow.set_experiment(experiment_name)
        except Exception as exc:
            logger.warning(f"MLflow disabled due to setup error: {exc}")
            self.enabled = False

    @staticmethod
    def _to_serializable(values: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not values:
            return {}
        serialized: Dict[str, Any] = {}
        for key, value in values.items():
            if isinstance(value, (str, int, float, bool)):
                serialized[key] = value
            elif value is None:
                serialized[key] = "None"
            else:
                serialized[key] = str(value)
        return serialized

    @staticmethod
    def _log_model_with_fallback(
        *,
        model: Any,
        model_artifact_path: str,
        input_example: Optional[pd.DataFrame] = None,
    ) -> None:
        """Log a model artifact without failing the whole run on serializer issues."""
        try:
            mlflow.sklearn.log_model(
                sk_model=model,
                name=model_artifact_path,
                input_example=input_example,
                serialization_format="skops",
            )
            return
        except Exception as exc:
            logger.warning(
                f"MLflow skops model logging failed for '{model_artifact_path}': {exc}. "
                "Retrying with cloudpickle."
            )

        try:
            mlflow.sklearn.log_model(
                sk_model=model,
                name=model_artifact_path,
                input_example=input_example,
                serialization_format="cloudpickle",
            )
        except Exception as exc:
            logger.warning(
                f"MLflow model artifact logging failed for '{model_artifact_path}': {exc}. "
                "Metrics and tags were logged, but the model artifact was skipped."
            )

    def log_run(
        self,
        *,
        run_name: str,
        params: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None,
        model: Any = None,
        model_artifact_path: str = "model",
        input_example: Optional[pd.DataFrame] = None,
    ) -> None:
        if not self.enabled:
            return

        safe_params = self._to_serializable(params)
        safe_metrics = {
            k: float(v)
            for k, v in self._to_serializable(metrics).items()
            if isinstance(v, (int, float))
        }
        safe_tags = {k: str(v) for k, v in (tags or {}).items()}
        if self.model_gating_enabled:
            safe_tags["mlflow.model_gating_enabled"] = "true"

        try:
            with mlflow.start_run(run_name=run_name):
                if safe_params:
                    mlflow.log_params(safe_params)
                if safe_metrics:
                    mlflow.log_metrics(safe_metrics)
                if safe_tags:
                    mlflow.set_tags(safe_tags)
                if model is not None:
                    self._log_model_with_fallback(
                        model=model,
                        model_artifact_path=model_artifact_path,
                        input_example=input_example,
                    )
        except Exception as exc:
            logger.warning(f"Failed to log MLflow run '{run_name}': {exc}")
