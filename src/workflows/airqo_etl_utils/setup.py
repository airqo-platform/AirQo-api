from setuptools import setup, find_packages

VERSION = "1.0.0"
DESCRIPTION = "AirQo Airflow custom python package"
LONG_DESCRIPTION = "This package contains functions shared by the DAG files"

setup(
    name="airqo_etl_utils",
    version=VERSION,
    author="AirQo",
    author_email="<data@airqo.net>",
    description=DESCRIPTION,
    long_description=LONG_DESCRIPTION,
    packages=find_packages(),
    package_data={"": ["*.json"]},
    install_requires=[
        "pandas",
        "requests",
        "simplejson",
        "kafka-python",
        "numpy",
        "pyarrow",
        "python-dotenv",
        "google-cloud-bigquery",
        "google-cloud-storage",
        "firebase-admin",
        "lightgbm~=4.1.0",
        "mlflow",
        "gcsfs~=2023.9.2",
        "pymongo~=4.5.0",
        "optuna",
        "tweepy",
        "scikit-learn==1.2.2",
        "great_expectations===0.18.18",
        "airflow-provider-great-expectations==0.2.8",
        "sqlalchemy-bigquery==1.11.0",
    ],
    keywords=["python", "airflow", "AirQo"],
    license="MIT",
    classifiers=[
        "Intended Audience :: AirQo Airflow Users",
        "Programming Language :: Python :: 3",
    ],
)
