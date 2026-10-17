from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from airqo_etl_utils import workflows_custom_utils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

LOGICAL_DATE = datetime(2026, 10, 15, 11, 10, tzinfo=timezone.utc)
RUN_AFTER = datetime(2026, 10, 15, 11, 12, tzinfo=timezone.utc)
HOST = "https://example.invalid"
BASE_URL = f"{HOST}/workflows"


class FakeSlackHook:
    created = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.sent = []
        FakeSlackHook.created.append(self)

    def send(self, **kwargs):
        self.sent.append(kwargs)
        return {"ok": True}


@pytest.fixture
def slack_hook(monkeypatch):
    FakeSlackHook.created = []
    monkeypatch.setattr(workflows_custom_utils, "SlackWebhookHook", FakeSlackHook)
    return FakeSlackHook


@pytest.fixture
def base_url(monkeypatch):
    monkeypatch.delenv("AIRFLOW__API__BASE_URL", raising=False)
    monkeypatch.setenv("AIRFLOW__WEBSERVER__BASE_URL", BASE_URL)
    return BASE_URL


def task_instance(log_url):
    return SimpleNamespace(
        dag_id="Weather-Measurements", task_id="extract", log_url=log_url
    )


def test_default_start_date_is_fixed_and_timezone_aware():
    first = AirflowUtils.dag_default_configs()
    second = AirflowUtils.dag_default_configs()
    assert first["start_date"] == datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert first["start_date"] == second["start_date"]
    assert first["on_failure_callback"] is AirflowUtils.dag_failure_notification


def test_log_url_joined_onto_the_host_is_rebuilt_under_the_base_url(base_url):
    path_and_query = (
        "/log?execution_date=2026-10-15T10%3A00%3A00%2B00%3A00"
        "&task_id=extract&dag_id=Weather-Measurements&map_index=-1"
    )
    log_url = AirflowUtils.task_log_url(task_instance(f"{HOST}{path_and_query}"))
    assert log_url == f"{base_url}{path_and_query}"


def test_log_url_under_the_base_url_is_unchanged(base_url):
    log_url = f"{base_url}/dags/Weather-Measurements/runs/r1/tasks/extract?try_number=1"
    assert AirflowUtils.task_log_url(task_instance(log_url)) == log_url


def test_log_url_is_unchanged_without_a_base_url(monkeypatch):
    monkeypatch.delenv("AIRFLOW__API__BASE_URL", raising=False)
    monkeypatch.delenv("AIRFLOW__WEBSERVER__BASE_URL", raising=False)
    log_url = f"{HOST}/log?task_id=extract"
    assert AirflowUtils.task_log_url(task_instance(log_url)) == log_url


def test_api_base_url_takes_precedence(monkeypatch):
    monkeypatch.setenv("AIRFLOW__API__BASE_URL", "https://api.example.invalid/workflows/")
    monkeypatch.setenv("AIRFLOW__WEBSERVER__BASE_URL", "https://web.example.invalid")
    assert AirflowUtils.web_base_url() == "https://api.example.invalid/workflows"


def test_failure_notification_posts_through_the_slack_connection(slack_hook, base_url):
    log_url = f"{base_url}/dags/Weather-Measurements/runs/r1/tasks/extract?try_number=1"
    context = {
        "task_instance": task_instance(log_url),
        "run_id": "scheduled__2026-10-15T10:10:00+00:00",
        "logical_date": LOGICAL_DATE,
        "dag_run": SimpleNamespace(run_type="scheduled"),
    }

    AirflowUtils.dag_failure_notification(context)

    assert [hook.kwargs for hook in slack_hook.created] == [
        {"slack_webhook_conn_id": "slack"}
    ]
    (sent,) = slack_hook.created[0].sent
    assert set(sent) == {"text"}
    assert context["run_id"] in sent["text"]
    assert log_url in sent["text"]
    assert str(LOGICAL_DATE) in sent["text"]


def test_failure_notification_for_a_run_without_a_logical_date(slack_hook, base_url):
    context = {
        "ti": task_instance(
            f"{base_url}/dags/Weather-Measurements/runs/m1/tasks/extract?try_number=1"
        ),
        "run_id": "manual__2026-10-15T11:12:00+00:00",
        "dag_run": SimpleNamespace(
            run_type="manual", logical_date=None, run_after=RUN_AFTER
        ),
    }

    AirflowUtils.dag_failure_notification(context)

    (sent,) = slack_hook.created[0].sent
    assert str(RUN_AFTER) in sent["text"]


def test_success_notification_uses_the_same_connection(slack_hook, base_url):
    context = {
        "task_instance": task_instance(f"{base_url}/dags/d/runs/r/tasks/t"),
        "run_id": "scheduled__2026-10-15T10:10:00+00:00",
        "logical_date": LOGICAL_DATE,
        "dag_run": SimpleNamespace(run_type="scheduled"),
    }

    AirflowUtils.dag_success_notification(context)

    assert [hook.kwargs for hook in slack_hook.created] == [
        {"slack_webhook_conn_id": "slack"}
    ]
    assert len(slack_hook.created[0].sent) == 1
