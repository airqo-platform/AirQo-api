#!/bin/bash
# kubectl exec --stdin --tty pod  -c airflow-webserver -- /bin/bash
airflow users create --role Admin --username $ADMIN_USERNAME --email $ADMIN_EMAIL --firstname $ADMIN_FIRSTNAME --lastname $ADMIN_LASTNAME --password $ADMIN_PASSWORD
exit 0