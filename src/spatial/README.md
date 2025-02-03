# REPORT.

## 1. Create venv file..

`python -m venv venv`

#### Linux and MacOS

`source venv/bin/activate`

#### Windows

`venv\scripts\activate`

### Install the necessary dependencies

`python.exe -m pip install --upgrade pip`
`pip install -r requirements.txt`

### Know your airqloud id

`Example`
`Uganda: `
`Cameroon: 6368b31b2fa4d3001e73e9c8`
`Kampala: `
`Kenya: 636629b22fa4d3001e739d0f`
`Fort Portal : 618b850c9326560036a453eb`

### RUN local

python main.py
flask run

### The API token

Create an API token from https://platform.airqo.net/settings
The process is highlighted here: https://docs.airqo.net/airqo-rest-api-documentation

#run postman
http://127.0.0.1:5000/api/v2/spatial/getisord

http://127.0.0.1:5000/api/v2/spatial/getisord_confidence

http://127.0.0.1:5000/api/v2/spatial/localmoran



{
"grid_id": "64b7f325d7249f0029fed743",
"start_time": "2024-01-01T00:00",
"end_time": "2024-01-27T00:00"
}

# Locate
Using Locate tool for site selection 
http://127.0.0.1:5000/api/v2/spatial/site_location?

the body should have;
    Required polygon and number of sensors as num_sensors
    Optional must_have_locations AND min_distance_km (by default  min_distance_km = 0.5)

{
  "polygon": {
    "coordinates":[[[36.960411,-1.441632],[36.935005,-1.432022], [36.960411,-1.441632]]]
  },
  "must_have_locations": [
     [-1.2790166, 36.816709] 
 ],
  "min_distance_km": 2.5,
  "num_sensors": 1
}


# Site Category
A tool to categorize sites based on their location and properties.
http://127.0.0.1:5000/api/v2/spatial/site_category?latitude={}&longitude={}

for a better result the latitude and longitude should have a high precision of up to 6 decimal places
