fetch branch from github.

create local python environment
  windows
	python -m venv [local_env_name e.g env]
	
   linux/mac
	python3 -m venv [local_env_name e.g env]

activate the environment
	windows
	- [local_env_name]\Scripts\activate
	
	linux/mac
	- source [local_env_name]/bin/activate

Install dependencies using the requirements.txt
	-pip install -r requirements.txt

set environment variables
	-navigate to  ml-api directory
 windows
 - set FLASK_APP=run.py
 - set FLASK_ENV=development

Run the Flask App
    - flask run