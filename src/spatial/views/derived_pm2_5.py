from flask import request, jsonify
from models.pull_satellite_model import PM25Model

class PM25View:
    @staticmethod
    def get_pm25():
        # Check if request has JSON content type
        if not request.is_json:
            return jsonify({'error': 'Request content type must be application/json'}), 400

        # Get JSON data from request
        data = request.get_json()

        # Check if all required parameters are present in the JSON data
        required_params = ['longitude', 'latitude', 'start_date', 'end_date']
        for param in required_params:
            if param not in data:
                return jsonify({'error': f'Missing parameter: {param}'}), 400

        # Retrieve parameters from the JSON data
        try:
            longitude = float(data['longitude'])
            latitude = float(data['latitude'])
            start_date = data['start_date']
            end_date = data['end_date']

            # Call the model to get PM2.5 data
            model = PM25Model()
            data = model.get_pm25_from_satellite(longitude, latitude, start_date, end_date)

            # Return the data with appropriate JSON format and headers
            response_data = {'Title': 'PM2.5 Prediction', 'determined_pm2_5': data.to_dict(orient='records')[0]}
            # Return the response with appropriate JSON format and headers
            return jsonify(response_data), 200, {'Content-Type': 'application/json'}

#            return jsonify(data.to_dict(orient='records')[0]), 200, {'Content-Type': 'application/json'}
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500, {'Content-Type': 'application/json'}

# Example usage
# This part should be handled in your Flask application's route handler
# pm_view = PM25View()
# pm_data, status_code, headers = pm_view.get_pm25()
# return pm_data, status_code, headers
