from flask import Flask, request, jsonify
from models.site_selection_model import SensorDeployment 

app = Flask(__name__)
# Assuming the classes SiteCategoryModel and SensorDeployment are already defined above or imported

class SiteSelectionView:
    @staticmethod
    def site_selection():
        data = request.json
        polygon = data.get('polygon')
        must_have_locations = data.get('must_have_locations', [])
        min_distance_km = data.get('min_distance_km', 3)
        num_sensors = data.get('num_sensors', len(must_have_locations) + 5)

        deployment = SensorDeployment(polygon, must_have_locations, min_distance_km)
        deployment.optimize_sensor_locations(num_sensors)
        deployment.categorize_sites()

        # Format the response as per your requirement
        formatted_sites = {
            "site_location": [
                {
                    "area_name": site.get('area_name', "Unknown"),
                    "category": site.get('category', "Unknown"),
                    "highway": site.get('highway', None),
                    "landuse": site.get('landuse', None),
                    "latitude": site['latitude'],
                    "longitude": site['longitude'],
                    "natural": site.get('natural', None)
                } for site in deployment.sites
            ],
                "site_information": {
                "total_sites": len(deployment.sites),
                "category_counts": deployment.get_category_counts(),  # Count of each category
            },
        #    "disclaimer": {
        #        "accuracy": "Sensor locations are estimated based on available data and optimization algorithms. Actual sensor placement may vary due to environmental factors, construction, or other unforeseen issues.",
        #        "privacy": "Location data is anonymized and used for operational purposes only. No personally identifiable information is collected or stored.",
        #        "usage": "This data is provided for informational purposes only. Any use of this data for commercial, legal, or other sensitive applications is at the user's own risk.",
        #        "liability": "The provider of this data assumes no liability for errors or omissions in the content of this service. The user of this service is responsible for verifying the accuracy of any information provided.",
        #        "terms": "By using this service, you agree to our Terms of Service and Privacy Policy. Unauthorized use or redistribution of this data is strictly prohibited."
        #    }
        }

        return jsonify(formatted_sites)