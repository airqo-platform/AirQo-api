from setuptools import setup, find_packages
import codecs
import os
import pathlib
HERE = pathlib.Path(__file__).parent
README = (HERE / "README.md").read_text()

VERSION = '0.0.736' 
VERSION = '0.0.737' 
DESCRIPTION = 'This is used for analyzing the obtain from IoT AirQo devices'
LONG_DESCRIPTION = README 

# Setting up
setup(
    name="airqloudanalysis",
    version=VERSION,
    author="AirQo",
    author_email="<gibson@airqo.net>",
    description=DESCRIPTION,
    long_description=README,
    long_description_content_type="text/markdown",
    url="https://github.com/OlukaGibson/deviceAnalysisLibrary.git",
    packages=find_packages(),
    install_requires=[
        'numpy>=1.21.0,<2.0.0',
        'pandas>=1.3.0,<2.0.0',
        'requests>=2.31.0,<3.0.0',
        'pytz>=2021.3',
        'python-dateutil>=2.8.2,<3.0.0',
        'beautifulsoup4>=4.10.0,<5.0.0',
        'matplotlib>=3.4.0,<4.0.0',
        'seaborn>=0.11.0,<1.0.0',
        'plotly>=5.0.0,<6.0.0',
        'cufflinks>=0.17.3',
    ],
    keywords=['python', 'IoT', 'AirQo', 'data', 'analysis', 'insights'],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Operating System :: MacOS :: MacOS X",
        "Operating System :: Microsoft :: Windows",
        "Operating System :: POSIX :: Linux",
    ]
)