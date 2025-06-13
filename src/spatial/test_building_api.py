from flask import Flask, request, jsonify
from pymongo import MongoClient
import ee
from google.oauth2 import service_account
from configure import Config
from datetime import datetime

# Initialize Flask
app = Flask(__name__)

# Initialize MongoDB
def connect_mongo():
    client = MongoClient(Config.MONGO_URI)
    return client[Config.DB_NAME]

db = connect_mongo()
collection = db["environment_and_buildings"]

# Initialize Earth Engine
credentials = service_account.Credentials.from_service_account_file(
    Config.CREDENTIALS,
    scopes=["https://www.googleapis.com/auth/earthengine"],
)
ee.Initialize(credentials=credentials, project=Config.GOOGLE_CLOUD_PROJECT_ID)

# ESA Class mapping
ESA_CLASSES = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare / sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen"
}

@app.route("/api/environment-profile", methods=["GET"])
def get_environment_profile():
    try:
        # Parameters
        lat = float(request.args.get("latitude"))
        lon = float(request.args.get("longitude"))
        radius = float(request.args.get("radius", 1000))  # default 1km
        location = {"type": "Point", "coordinates": [lon, lat]}

        point = ee.Geometry.Point([lon, lat])
        buffer = point.buffer(radius)

        # === BUILDINGS ===
        buildings = ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons") \
            .filterBounds(buffer) \
            .filter(ee.Filter.gte("confidence", 0.7)) \
            .limit(500)

        buildings_data = buildings.getInfo()["features"]

        # === LAND COVER ===
        landcover = ee.Image("ESA/WorldCover/v200/2021").clip(buffer)
        counts = landcover.reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=buffer,
            scale=10,
            maxPixels=1e9
        ).get("Map").getInfo()

        total = sum(counts.values())
        landcover_summary = {
            ESA_CLASSES.get(int(k), f"Unknown ({k})"): {
                "pixel_count": v,
                "percentage": round((v / total) * 100, 2)
            } for k, v in counts.items()
        }

        # Save document to MongoDB
        document = {
            "location": location,
            "radius_m": radius,
            "timestamp": datetime.utcnow(),
            "building_count": len(buildings_data),
            "buildings": buildings_data,
            "landcover_summary": landcover_summary
        }

        result_id = collection.insert_one(document).inserted_id
        return jsonify({"status": "success", "id": str(result_id)})

    except Exception as e:
        return jsonify("error buildings not got"), 500
