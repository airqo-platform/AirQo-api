from __future__ import annotations

import os
import sys
import types


def apply_common_import_stubs() -> None:
    """Stub optional runtime dependencies needed by config/datautils imports."""
    os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")

    tweepy = types.ModuleType("tweepy")
    tweepy.Client = lambda *args, **kwargs: object()
    tweepy.OAuthHandler = lambda *args, **kwargs: object()
    sys.modules.setdefault("tweepy", tweepy)

    confluent_kafka = types.ModuleType("confluent_kafka")
    confluent_kafka.KafkaException = Exception
    confluent_kafka.Producer = object
    confluent_kafka.Consumer = object
    confluent_kafka.TopicPartition = object
    sys.modules.setdefault("confluent_kafka", confluent_kafka)

    cdsapi = types.ModuleType("cdsapi")
    cdsapi.Client = object
    sys.modules.setdefault("cdsapi", cdsapi)

    great_expectations = types.ModuleType("great_expectations")
    great_expectations.get_context = lambda *args, **kwargs: object()
    sys.modules.setdefault("great_expectations", great_expectations)

    great_expectations_exceptions = types.ModuleType("great_expectations.exceptions")
    great_expectations_exceptions.DataContextError = Exception
    sys.modules.setdefault(
        "great_expectations.exceptions", great_expectations_exceptions
    )

    great_expectations_data_context = types.ModuleType(
        "great_expectations.data_context.types.base"
    )
    great_expectations_data_context.DataContextConfig = object
    sys.modules.setdefault(
        "great_expectations.data_context.types.base",
        great_expectations_data_context,
    )

    great_expectations_core = types.ModuleType(
        "great_expectations.core.expectation_configuration"
    )

    class _ExpectationConfiguration:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    great_expectations_core.ExpectationConfiguration = _ExpectationConfiguration
    sys.modules.setdefault(
        "great_expectations.core.expectation_configuration",
        great_expectations_core,
    )


def apply_ml_utils_import_stubs() -> None:
    """Add optional training-related dependencies imported by ml_utils."""
    apply_common_import_stubs()

    mlflow = types.ModuleType("mlflow")
    mlflow.set_tracking_uri = lambda *args, **kwargs: None
    mlflow.set_registry_uri = lambda *args, **kwargs: None
    mlflow.set_experiment = lambda *args, **kwargs: None
    mlflow.log_params = lambda *args, **kwargs: None
    mlflow.log_metrics = lambda *args, **kwargs: None
    mlflow.set_tags = lambda *args, **kwargs: None
    mlflow.end_run = lambda *args, **kwargs: None
    mlflow.active_run = lambda: None
    mlflow.lightgbm = types.SimpleNamespace(autolog=lambda *args, **kwargs: None)
    mlflow.sklearn = types.SimpleNamespace(log_model=lambda *args, **kwargs: None)

    class _MlflowRun:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    mlflow.start_run = lambda *args, **kwargs: _MlflowRun()
    sys.modules.setdefault("mlflow", mlflow)

    class _TPESampler:
        pass

    class _SuccessiveHalvingPruner:
        def __init__(self, *args, **kwargs):
            pass

    class _TrialPruned(Exception):
        pass

    optuna = types.ModuleType("optuna")
    optuna.samplers = types.SimpleNamespace(TPESampler=_TPESampler)
    optuna.pruners = types.SimpleNamespace(
        SuccessiveHalvingPruner=_SuccessiveHalvingPruner
    )
    optuna.TrialPruned = _TrialPruned
    optuna.create_study = lambda *args, **kwargs: types.SimpleNamespace(
        best_trial=None,
        optimize=lambda *args, **kwargs: None,
    )
    sys.modules.setdefault("optuna", optuna)

    lightgbm = types.ModuleType("lightgbm")
    lightgbm.LGBMRegressor = object
    lightgbm.early_stopping = lambda *args, **kwargs: None
    sys.modules.setdefault("lightgbm", lightgbm)
