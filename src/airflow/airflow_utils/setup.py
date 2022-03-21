from setuptools import setup, find_packages

VERSION = "1.0.0"
DESCRIPTION = "AirQo Airflow custom python package"
LONG_DESCRIPTION = "This package contains functions shared by the DAG files"


setup(
    name="airflow_utils",
    version=VERSION,
    author="AirQo Devs",
    author_email="<airqo.analytics@gmail.com>",
    description=DESCRIPTION,
    long_description=LONG_DESCRIPTION,
    packages=find_packages(),
    install_requires=[
        "pandas",
        "requests",
        "simplejson",
        "python-dotenv",
        "kafka-python",
        "numpy",
    ],
    keywords=["python", "airflow", "airqo"],
    license="MIT",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: AirQo Airflow Users",
        "Programming Language :: Python :: 3",
        "Operating System :: MacOS :: MacOS X",
        "Operating System :: Microsoft :: Windows",
    ],
)
