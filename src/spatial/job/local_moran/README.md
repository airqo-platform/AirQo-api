#READme.md
# REPORT
## 1. Create venv file
```python -m venv venv```
#### Linux and MacOS
```source venv/bin/activate```
#### Windows
```venv\scripts\activate```

### Install the necessary dependencies
```python.exe -m pip install --upgrade pip```
```pip install -r requirements.txt```

### Know your airqloud id
```Example```
```Uganda: ```
```Cameroon: 6368b31b2fa4d3001e73e9c8```
```Kampala: ```
```Kenya: 636629b22fa4d3001e739d0f```
```Fort Portal : 618b850c9326560036a453eb```

### RUN local 
python main.py
### RUN local on web browser
python app.py
python main.py
### API token 
Create an API token from https://platform.airqo.net/settings
    Registered Clients
        Generate Token
    Access Tokens

#run     postman
http://127.0.0.1:5000/spatial

{
    "grid_id": "64b7f325d7249f0029fed743",
    "start_time": "2024-01-01T00:00",
    "end_time": "2024-01-27T00:00"
}
 