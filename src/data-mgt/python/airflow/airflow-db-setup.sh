#!/bin/bash
# kubectl exec --stdin --tty pod -- /bin/bash
apt-get update -y
apt-get install python3-pip -y
pip3 install apache-airflow[postgres]==2.2.3 --constraint https://raw.githubusercontent.com/apache/airflow/constraints-2.2.3/constraints-3.7.txt
airflow db init
exit 0