from airflow.hooks.base import BaseHook
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from config import configuration


def slack_success_notification(context):
    slack_webhook_token = BaseHook.get_connection("slack").password

    msg = """
          :green_circle: Task Successful. 
          *Task*: {task}  
          *Dag*: {dag} 
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    success_alert = SlackWebhookOperator(
        task_id="slack_success_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return success_alert.execute(context=context)


def slack_dag_failure_notification(context):
    slack_webhook_token = BaseHook.get_connection("slack").password
    icon_color = (
        ":red_circle"
        if configuration.ENVIRONMENT.lower() == "production"
        else ":yellow_circle"
    )

    msg = """
          {icon_color}: Task Failed. 
          *Task*: {task}  
          *Dag*: {dag}
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        icon_color=icon_color,
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    failed_alert = SlackWebhookOperator(
        task_id="slack_failed_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return failed_alert.execute(context=context)
