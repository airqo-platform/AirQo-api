fetch branch from github.
- `git fetch origin <branch-name>`
- `git checkout <branch-name>`

create local python environment

windows

`python -m venv [local_env_name e.g env]`

linux/mac

`python3 -m venv [local_env_name e.g env]`

activate the environment
windows
- `[local_env_name]\Scripts\activate`

linux/mac
- source `[local_env_name]/bin/activate`

Install dependencies using the requirements.txt
- `pip install -r requirements.txt`

set environment variables
windows
- `set FLASK_APP=app.py`
- `set FLASK_ENV=development`
linux/mac
- `export FLASK_APP=app.py`
- `export FLASK_ENV=development`


Run the Flask App
- `flask run`