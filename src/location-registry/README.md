

fetch branch from github.

create anaconda environment conda config --prepend channels conda-forge conda create -n env --strict-channel-priority osmnx

activate the environment windows - env\Scripts\activate

linux/mac
- source env/bin/activate

Install dependencies using the requirements.txt -pip install -r requirements.txt

set environment variables windows - set FLASK_APP=app.py - set FLASK_ENV=development linux/mac - export FLASK_APP=app.py - export FLASK_ENV=development

Run the Flask App - flask run
