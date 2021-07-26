## Device Status

#### Local Setup using a Python virtual environment
* Create local python environment
    * windows
	`python -m venv [local_env_name e.g env]`

    * linux/mac
	`python3 -m venv [local_env_name e.g env]`

* Activate the environment
    * windows  
	  `env\scripts\activate`
	
	* linux/mac
	  `source env/bin/activate`


* Install required packages
     * `pip install -r requirements.txt`
     
* Create a `.env` file with the following keys
    * **ENV** e.g `staging`
    * **REGISTRY_MONGO_GCE_URI**
    * **MONITORING_MONGO_GCE_URI**
    * **REGISTRY_MONGO_DEV_URI**
    * **MONITORING_MONGO_DEV_URI**
    * **DB_NAME_DEV**
    * **DB_NAME_PROD**
    * **DB_NAME_STAGE**
    * **SECRET_KEY**
    
* Run script
    * `python main.py`. tenant here defaults to `airqo`
    * or explicitly state the tenant `python main.py --tenant=airqo`
    
#### Local Setup using docker
* Coming soon...