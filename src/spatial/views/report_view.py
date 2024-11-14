from flask import request, jsonify
from models.report_datafetcher import DataFetcher, AirQualityReport

class ReportView:
    @staticmethod
    def generate_air_quality_report():
        """Fetch air quality data and generate a report based on grid_id, start_time, end_time, and audience."""
        print('Processing request to generate air quality report...')

        # Extract data from the request
        data = request.json
        grid_id = data.get("grid_id")
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        audience = data.get("audience", "general public")  # Default to "general public" if audience is not provided

        # Validate input parameters
        if not all([grid_id, start_time, end_time, audience]):
            return jsonify({"error": "Missing required parameters: grid_id, start_time, end_time, audience"}), 400

        # Fetch air quality data
        air_quality_data = DataFetcher.fetch_air_quality_data_a(grid_id, start_time, end_time)

        if air_quality_data is None:
            return jsonify({"error": "No data found for the given parameters"}), 404

        # Create an air quality report
        report = AirQualityReport(air_quality_data)
        
        # Generate the report with the specified audience
        json_report = report.generate_report_with_gemini(audience)          # using google gemini
    #    json_report = report.generate_report_without_llm()
    #    json_report = report.generate_text_with_gpt_neo(audience) # without LLM
    #    json_report = report.generate_report_with_openai(audience)         # Using openai api 
    
        
        if json_report is None:
            return jsonify({"error": "Failed to generate report"}), 500

        return jsonify({"report": json_report}), 200
 
 