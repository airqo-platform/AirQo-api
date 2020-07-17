fetch branch from github.

create local python environment
  windows
	python -m venv [local_env_name]
	
   linux/mac
	python3 -m venv [local_env_name]

activate the environment
	windows
	- [local_env_name]\Scripts\activate
	
	linux/mac
	- source [local_env_name]/bin/activate

Install dependencies using the requirements.txt
	-pip install -r packages\ml-api\requirements.txt


set environment variables
	-navigate to  ml-api directory
 widows
 - set GOOGLE_APPLICATION_CREDENTIALS=[credentials-file.json]
 - set FLASK_APP=run.py
 - set FLASK_ENV=development

Run the Flask App
    - flask run