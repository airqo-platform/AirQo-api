from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import mlflow
import pandas as pd

logger = logging.getLogger("airflow.task")


class MlflowTracker:
    """MLflow helper for training runs, logging, and model artifacts.

    This helper is safe to use inside production pipelines: if MLflow is
    misconfigured the tracker disables itself and logging calls become no-ops.
    It supports setting tracking/registry URIs and an experiment on
    initialization, converting parameters/metrics to serializable types,
    logging params, metrics and tags, and saving sklearn models using
    skops serialization.
    """

    def __init__(
        self,
        *,
        tracking_uri: Optional[str] = None,
        registry_uri: Optional[str] = None,
        experiment_name: Optional[str] = None,
        model_gating_enabled: bool = False,
        enabled: bool = True,
    ):
        """Initialize the tracker.

        Args:
            tracking_uri: Optional MLflow tracking server URI.
            registry_uri: Optional MLflow model registry URI.
            experiment_name: Optional experiment to set for subsequent runs.
            model_gating_enabled: When True, records a tag enabling model gating.
            enabled: When False the tracker becomes a no-op.
        """
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
        """Return a JSON-friendly copy of *values*.

        - Preserves strings, ints, floats and booleans.
        - Replaces ``None`` with the literal string ``"None"`` to avoid
          MLflow treating it as a missing value.
        - Converts other objects to their string representation.
        """
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

    @staticmethod
    def _infer_run_status(tags: Dict[str, str]) -> str:
        deployment_status = tags.get("deployment_status", "").strip().lower()
        deployed = tags.get("deployed", "").strip().lower()

        if deployment_status == "not_deployed" or deployed == "false":
            return "FAILED"

        return "FINISHED"

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
        """Log a single MLflow run (params, metrics, tags, and optional model).

        This is best-effort: any exception raised by MLflow is caught and logged
        at warning level so that pipelines remain resilient to tracking issues.

        Args:
            run_name: Human-readable name for the MLflow run.
            params: Mapping of parameters to log (will be made serializable).
            metrics: Mapping of numeric metrics to log.
            tags: Optional tag mapping; `model_gating_enabled` adds a tag when set.
            model: Optional sklearn-like model object to persist with the run.
            model_artifact_path: Path under the run artifacts where the model is saved.
            input_example: Optional pandas DataFrame used as an `input_example`.
        """
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
        run_status = self._infer_run_status(safe_tags)
        active_run = None

        try:
            active_run = mlflow.start_run(run_name=run_name)
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
            run_status = "FAILED"
            logger.warning(f"Failed to log MLflow run '{run_name}': {exc}")
        finally:
            if active_run is not None:
                mlflow.end_run(status=run_status)
