from flask import request, jsonify
from models.report_datafetcher import DataFetcher, AirQualityReport
import logging

class ReportView:
    @staticmethod
    def generate_air_quality_report():
        """Fetch air quality data and generate a report based on grid_id, start_time, end_time, and audience."""
        logging.info('Processing request to generate air quality report...')
        
        # Extract and validate request data
        data = ReportView._get_request_data()
        if isinstance(data, dict) and data.get("error"):
            return jsonify(data), 400

        grid_id = data["grid_id"]
        start_time = data["start_time"]
        end_time = data["end_time"]
        audience = data.get("audience", "general public")  # Default value if not provided

        try:
            # Fetch air quality data
            air_quality_data = DataFetcher.fetch_air_quality_data_a(grid_id, start_time, end_time)
            if not air_quality_data:
                logging.warning(f"No data found for grid_id: {grid_id}, start_time: {start_time}, end_time: {end_time}")
                return jsonify({"error": "No data found for the given parameters"}), 404

            # Generate the air quality report
            report = AirQualityReport(air_quality_data)
            json_report = ReportView._generate_report(report, audience)
            if not json_report:
                logging.error("Failed to generate the air quality report.")
                return jsonify({"error": "Failed to generate report"}), 500

            return jsonify({"report": json_report}), 200

        except Exception as e:
            logging.exception("Unexpected error occurred during report generation")
            return jsonify({"error": "An unexpected error occurred"}), 500

    @staticmethod
    def _get_request_data():
        """Helper function to extract and validate request data."""
        try:
            data = request.get_json()
            if not data:
                logging.error("Invalid input: JSON data expected.")
                return {"error": "Invalid input. JSON data expected."}
            
            required_params = ["grid_id", "start_time", "end_time"]
            missing_params = [param for param in required_params if not data.get(param)]
            if missing_params:
                logging.error(f"Missing required parameters: {', '.join(missing_params)}")
                return {"error": f"Missing required parameters: {', '.join(missing_params)}"}
            
            return data
        except Exception as e:
            logging.exception("Error parsing input data.")
            return {"error": "Error parsing input data."}

    @staticmethod
    def _generate_report(report, audience):
        """Helper function to generate report based on the audience type."""
        try:
            # Generate the report with the specified audience
            # You can extend this logic to switch between different report generation methods
            json_report = report.generate_report_without_llm()  # Example of one option
            # json_report = report.generate_report_with_gemini(audience)  # Using Google Gemini (if applicable)
            # json_report = report.generate_report_with_openai(audience)  # Using OpenAI API (if applicable)
            # json_report = report.generate_report_template_without_llm(audience)  # Without LLM, audience-specific
            
            return json_report
        except Exception as e:
            logging.exception("Error generating the report.")
            return None
