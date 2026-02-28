import importlib.util
from pathlib import Path
import sys
import types


CURRENT_DIR = Path(__file__).resolve().parent
WORKFLOWS_DIR = CURRENT_DIR.parents[1]
DAG_FILE = WORKFLOWS_DIR / "dags" / "fault_detection_job.py"

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(WORKFLOWS_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOWS_DIR))


def load_fault_detection_module():
    class FakeTaskResult:
        def __init__(self, task_id):
            self.task_id = task_id

    class FakeTask:
        def __init__(self, task_id):
            self.task_id = task_id
            self.upstream_task_ids = set()

    class FakeDag:
        def __init__(self, dag_id, schedule, catchup):
            self.dag_id = dag_id
            self.normalized_schedule_interval = schedule
            self.catchup = catchup
            self.tasks = {}

        @property
        def task_ids(self):
            return list(self.tasks.keys())

        def get_task(self, task_id):
            return self.tasks[task_id]

    state = {"current_dag": None}

    def fake_task(*task_args, **task_kwargs):
        def decorator(func):
            task_id = task_kwargs.get("task_id", func.__name__)

            def wrapper(*args, **kwargs):
                current_dag = state["current_dag"]
                task = current_dag.tasks.setdefault(task_id, FakeTask(task_id))
                upstream_task_ids = {
                    arg.task_id for arg in args if isinstance(arg, FakeTaskResult)
                }
                upstream_task_ids.update(
                    value.task_id
                    for value in kwargs.values()
                    if isinstance(value, FakeTaskResult)
                )
                task.upstream_task_ids.update(upstream_task_ids)
                return FakeTaskResult(task_id)

            return wrapper

        return decorator

    def fake_dag(dag_id, schedule=None, default_args=None, catchup=False, tags=None):
        def decorator(func):
            def wrapper(*args, **kwargs):
                dag = FakeDag(dag_id=dag_id, schedule=schedule, catchup=catchup)
                previous_dag = state["current_dag"]
                state["current_dag"] = dag
                try:
                    func(*args, **kwargs)
                finally:
                    state["current_dag"] = previous_dag
                return dag

            return wrapper

        return decorator

    airflow_module = types.ModuleType("airflow")
    decorators_module = types.ModuleType("airflow.decorators")
    decorators_module.dag = fake_dag
    decorators_module.task = fake_task
    airflow_module.decorators = decorators_module

    workflow_utils_module = types.ModuleType("airqo_etl_utils.workflows_custom_utils")

    class StubAirflowUtils:
        @staticmethod
        def dag_default_configs():
            return {"owner": "AirQo"}

    workflow_utils_module.AirflowUtils = StubAirflowUtils

    ml_utils_module = types.ModuleType("airqo_etl_utils.ml_utils")

    class StubFaultDetectionUtils:
        @staticmethod
        def flag_rule_based_faults(data):
            return data

        @staticmethod
        def get_time_features(data, frequency):
            return data

        @staticmethod
        def get_cyclic_features(data, frequency):
            return data

        @staticmethod
        def flag_pattern_based_faults(data):
            return data

        @staticmethod
        def process_faulty_devices_percentage(data):
            return data

        @staticmethod
        def process_faulty_devices_fault_sequence(data):
            return data

        @staticmethod
        def flag_ml_based_faults(data):
            return data

        @staticmethod
        def save_faulty_devices(*data):
            return data

        @staticmethod
        def train_fault_detection_model(data):
            return data

    ml_utils_module.FaultDetectionUtils = StubFaultDetectionUtils

    previous_modules = {
        "airflow": sys.modules.get("airflow"),
        "airflow.decorators": sys.modules.get("airflow.decorators"),
        "airqo_etl_utils.workflows_custom_utils": sys.modules.get(
            "airqo_etl_utils.workflows_custom_utils"
        ),
        "airqo_etl_utils.ml_utils": sys.modules.get("airqo_etl_utils.ml_utils"),
    }

    sys.modules["airflow"] = airflow_module
    sys.modules["airflow.decorators"] = decorators_module
    sys.modules["airqo_etl_utils.workflows_custom_utils"] = workflow_utils_module
    sys.modules["airqo_etl_utils.ml_utils"] = ml_utils_module

    try:
        spec = importlib.util.spec_from_file_location("test_fault_detection_job", DAG_FILE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        for module_name, previous_module in previous_modules.items():
            if previous_module is None:
                sys.modules.pop(module_name, None)
            else:
                sys.modules[module_name] = previous_module


def test_fault_detection_dag_configuration():
    dag_module = load_fault_detection_module()
    fault_detection_dag = dag_module.fault_detection_dag

    assert fault_detection_dag.dag_id == "AirQo-Fault-Detection"
    assert str(fault_detection_dag.normalized_schedule_interval) == "0 1 * * 1"
    assert fault_detection_dag.catchup is False
    assert set(fault_detection_dag.task_ids) == {
        "fetch_raw_data",
        "flag_rule_based_faults",
        "get_time_features",
        "get_cyclic_features",
        "flag_pattern_based_faults",
        "process_faulty_devices_percentage",
        "process_faulty_devices_sequence",
        "flag_ml_based_faults",
        "save_to_mongo",
    }

    save_task = fault_detection_dag.get_task("save_to_mongo")
    assert save_task.upstream_task_ids == {
        "flag_rule_based_faults",
        "process_faulty_devices_percentage",
        "process_faulty_devices_sequence",
        "flag_ml_based_faults",
    }


def test_fault_detection_training_dag_configuration():
    dag_module = load_fault_detection_module()
    fault_detection_training_dag = dag_module.fault_detection_training_dag

    assert fault_detection_training_dag.dag_id == "AirQo-Fault-Detection-Model-Training"
    assert str(fault_detection_training_dag.normalized_schedule_interval) == "0 23 * * 0"
    assert fault_detection_training_dag.catchup is False
    assert set(fault_detection_training_dag.task_ids) == {
        "fetch_training_data",
        "build_time_features",
        "build_cyclic_features",
        "train_model",
    }

    train_task = fault_detection_training_dag.get_task("train_model")
    assert train_task.upstream_task_ids == {"build_cyclic_features"}
