# Air Quality Spatial Analysis API

This repository provides tools for spatial air quality analysis, including Moran's I and Getis-Ord analyses, site categorization, and sensor placement optimization.

## 1. Setting Up the Virtual Environment

### Create a Virtual Environment

Run the following command to create a virtual environment:

```sh
python -m venv venv
```

### Activate the Virtual Environment

#### Linux and macOS
```sh
source venv/bin/activate
```

#### Windows
```sh
venv\Scripts\activate
```

### Install Dependencies

Ensure you have the necessary dependencies installed:

```sh
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 2. Identifying Your AirQloud ID

Different regions have specific AirQloud IDs. Below are some examples:

- **Uganda**:
- **Cameroon**: `6368b31b2fa4d3001e73e9c8`
- **Kampala**:
- **Kenya**: `636629b22fa4d3001e739d0f`
- **Fort Portal**: `618b850c9326560036a453eb`

## 3. Running the Application Locally

Start the application with the following command:

```sh
python main.py
```

Alternatively, you can run Flask directly:

```sh
flask run
```

## 4. API Authentication

To access the API, generate an API token at [AirQo Platform](https://platform.airqo.net/settings).
For detailed instructions, refer to the [AirQo API Documentation](https://docs.airqo.net/airqo-rest-api-documentation).

## 5. API Endpoints

### **Spatial Analysis Tools**

#### Getis-Ord Hotspot Analysis
```http
GET http://127.0.0.1:5000/api/v2/spatial/getisord
```

#### Getis-Ord Confidence Analysis
```http
GET http://127.0.0.1:5000/api/v2/spatial/getisord_confidence
```

#### Local Moran’s I Analysis
```http
GET http://127.0.0.1:5000/api/v2/spatial/localmoran
```

##### Example Request Body
```json
{
  "grid_id": "64b7f325d7249f0029fed743",
  "start_time": "2024-01-01T00:00",
  "end_time": "2024-01-27T00:00"
}
```

### **Site Selection Using Locate Tool**

Use this tool to select monitoring sites based on a defined area.

```http
GET http://127.0.0.1:5000/api/v2/spatial/site_location
```

#### Required Parameters:
- `polygon` (GeoJSON format) – Defines the area of interest.
- `num_sensors` – Number of sensors to deploy.

#### Optional Parameters:
- `must_have_locations` – Specific coordinates that must be included.
- `min_distance_km` – Minimum distance between selected sites (default: 0.5 km).

##### Example Request Body
```json
{
  "polygon": {
    "coordinates": [
      [[36.960411, -1.441632], [36.935005, -1.432022], [36.960411, -1.441632]]
    ]
  },
  "must_have_locations": [
    [-1.2790166, 36.816709]
  ],
  "min_distance_km": 2.5,
  "num_sensors": 1
}
```

### **Site Categorization Tool**

Categorize a monitoring site based on its geographic properties.

```http
GET http://127.0.0.1:5000/api/v2/spatial/site_category?latitude={latitude}&longitude={longitude}
```

Ensure latitude and longitude have high precision (up to six decimal places) for accurate categorization.

---

This README provides an overview of the setup, API endpoints, and example requests. For further details, consult the official AirQo API documentation.

