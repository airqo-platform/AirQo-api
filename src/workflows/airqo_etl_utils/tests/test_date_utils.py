from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from airqo_etl_utils.date import DateUtils

LOGICAL_DATE = datetime(2026, 10, 15, 11, 10, tzinfo=timezone.utc)
RUN_AFTER = datetime(2026, 10, 15, 11, 12, tzinfo=timezone.utc)
WINDOW = {
    "start_date_time": "2026-10-01T00:00:00Z",
    "end_date_time": "2026-10-02T00:00:00Z",
}


def airflow_2_dag_run(run_type="scheduled", conf=None):
    return SimpleNamespace(
        run_type=run_type,
        execution_date=LOGICAL_DATE,
        logical_date=LOGICAL_DATE,
        external_trigger=run_type == "manual",
        conf=conf or {},
    )


def airflow_3_dag_run(run_type="scheduled", logical_date=LOGICAL_DATE, conf=None):
    return SimpleNamespace(
        run_type=run_type,
        logical_date=logical_date,
        run_after=RUN_AFTER,
        conf=conf or {},
    )


def test_run_time_is_the_context_logical_date():
    run_time = DateUtils.get_dag_run_time(
        dag_run=airflow_2_dag_run(), logical_date=LOGICAL_DATE
    )
    assert run_time == LOGICAL_DATE


def test_run_time_falls_back_to_run_after():
    dag_run = airflow_3_dag_run(run_type="manual", logical_date=None)
    assert DateUtils.get_dag_run_time(dag_run=dag_run) == RUN_AFTER


def test_run_time_without_dag_run_is_the_current_utc_time():
    before = datetime.now(timezone.utc)
    run_time = DateUtils.get_dag_run_time()
    assert run_time.tzinfo is not None
    assert before <= run_time <= datetime.now(timezone.utc)


def test_scheduled_window_from_an_airflow_2_run():
    start, end = DateUtils.get_dag_date_time_values(
        days=3, dag_run=airflow_2_dag_run(), logical_date=LOGICAL_DATE
    )
    assert (start, end) == ("2026-10-12T00:00:00Z", "2026-10-15T23:59:59Z")


def test_scheduled_window_from_an_airflow_3_run():
    start, end = DateUtils.get_dag_date_time_values(
        days=3, dag_run=airflow_3_dag_run(), logical_date=LOGICAL_DATE
    )
    assert (start, end) == ("2026-10-12T00:00:00Z", "2026-10-15T23:59:59Z")


def test_hour_window_ends_in_the_run_hour():
    start, end = DateUtils.get_dag_date_time_values(
        hours=2, dag_run=airflow_3_dag_run(), logical_date=LOGICAL_DATE
    )
    assert (start, end) == ("2026-10-15T09:00:00Z", "2026-10-15T11:59:59Z")


def test_manual_run_uses_params():
    start, end = DateUtils.get_dag_date_time_values(
        dag_run=airflow_2_dag_run(run_type="manual"), params=WINDOW
    )
    assert (start, end) == (WINDOW["start_date_time"], WINDOW["end_date_time"])


def test_manual_run_uses_conf():
    dag_run = airflow_3_dag_run(run_type="manual", logical_date=None, conf=WINDOW)
    start, end = DateUtils.get_dag_date_time_values(dag_run=dag_run, params={})
    assert (start, end) == (WINDOW["start_date_time"], WINDOW["end_date_time"])


def test_manual_run_without_a_window_uses_run_after():
    dag_run = airflow_3_dag_run(run_type="manual", logical_date=None)
    start, end = DateUtils.get_dag_date_time_values(dag_run=dag_run, params={})
    assert (start, end) == ("2026-10-14T00:00:00Z", "2026-10-15T23:59:59Z")


def test_query_window_is_the_previous_full_hour():
    start, end = DateUtils.get_query_date_time_values(
        dag_run=airflow_3_dag_run(), logical_date=LOGICAL_DATE
    )
    assert (start, end) == ("2026-10-15T10:00:00Z", "2026-10-15T11:00:00Z")


def test_query_window_without_context_spans_one_hour():
    start, end = DateUtils.get_query_date_time_values()
    assert DateUtils.str_to_date(end) - DateUtils.str_to_date(start) == timedelta(
        hours=1
    )
