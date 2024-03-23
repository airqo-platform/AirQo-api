# GP Model

This folder contains functionality for running the GP model, mainly used in spatial temporal modelling works.

## Environment setup
* Add the `.env` file. This can be obtained from the project owner. 
For team members, this can be accessed from GCP secret manager(`sta-env-gp-model`)

## Running the model
### Create a Python virtual environment
```python -m venv venv```

* Ensure to use `python3.7` or `python3.8` as the python version.
* If you have mutliple python versions, you can specify the python version as follows:
  ```python3.8 -m venv venv```

## Activate the virtual environment
#### Linux and MacOS
```source venv/bin/activate```
#### Windows
```source venv\bin\activate```

### Install the necessary dependencies
```pip install -r requirements.txt```

### Running the model

```python main.py```

## Running the model with Docker
### Build the image
```docker build -t gp-model .```

### Run the image

```docker run gp-model```

* This is a CRON job only thus it does not require any ports to be exposed.

