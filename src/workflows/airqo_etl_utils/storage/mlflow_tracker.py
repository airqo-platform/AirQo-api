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
    def _format_date_param(value: Any) -> str:
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return "unknown"
        return parsed.strftime("%Y-%m-%d")

    def log_run(
        self,
        *,
        run_name: str,
        params: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None,
        terminal_status: str = "FINISHED",
        model: Any = None,
        model_artifact_path: str = "model",
        dataset_metadata: Optional[Dict[str, Any]] = None,
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
            mlflow.start_run(run_name=run_name)
            if dataset_metadata:
                try:
                    dataset_frame = pd.DataFrame(
                        [
                            {
                                "start_date": pd.to_datetime(
                                    dataset_metadata.get("start_date"),
                                    errors="coerce",
                                ),
                                "end_date": pd.to_datetime(
                                    dataset_metadata.get("end_date"),
                                    errors="coerce",
                                ),
                                "row_count": int(dataset_metadata.get("row_count", 0)),
                            }
                        ]
                    )
                    dataset = mlflow.data.from_pandas(
                        df=dataset_frame,
                        source="training_window",
                        name="training_dataset",
                    )
                    mlflow.log_input(dataset, context="training")
                except Exception as exc:
                    logger.warning(
                        f"Failed to log MLflow dataset metadata for '{run_name}': {exc}"
                    )
                try:
                    mlflow.log_params(
                        {
                            "training_start_date": self._format_date_param(
                                dataset_metadata.get("start_date")
                            ),
                            "training_end_date": self._format_date_param(
                                dataset_metadata.get("end_date")
                            ),
                            "training_row_count": int(
                                dataset_metadata.get("row_count", 0)
                            ),
                        }
                    )
                except Exception as exc:
                    logger.warning(
                        f"Failed to log MLflow dataset params for '{run_name}': {exc}"
                    )
                try:
                    mlflow.set_tags(
                        {
                            "training_start_date": self._format_date_param(
                                dataset_metadata.get("start_date")
                            ),
                            "training_end_date": self._format_date_param(
                                dataset_metadata.get("end_date")
                            ),
                            "training_row_count": str(
                                int(dataset_metadata.get("row_count", 0))
                            ),
                        }
                    )
                except Exception as exc:
                    logger.warning(
                        f"Failed to log MLflow dataset tags for '{run_name}': {exc}"
                    )
            if safe_params:
                mlflow.log_params(safe_params)
            if safe_metrics:
                mlflow.log_metrics(safe_metrics)
            if safe_tags:
                mlflow.set_tags(safe_tags)
            if model is not None:
                try:
                    mlflow.sklearn.log_model(
                        sk_model=model,
                        name=model_artifact_path,
                        input_example=input_example,
                        serialization_format="skops",
                    )
                except Exception as exc:
                    logger.warning(
                        f"Failed to log MLflow model artifact for '{run_name}': {exc}"
                    )
            mlflow.end_run(status=terminal_status)
        except Exception as exc:
            if mlflow.active_run() is not None:
                try:
                    mlflow.end_run(status="FAILED")
                except Exception:
                    pass
            logger.warning(f"Failed to log MLflow run '{run_name}': {exc}")
