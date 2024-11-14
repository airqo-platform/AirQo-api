from flask import request, jsonify
from models.report_datafetcher import DataFetcher, AirQualityReport

class ReportView:
    @staticmethod
    def _fetch_and_validate_request_data():
        """Extract and validate request data."""
        data = request.json
        grid_id = data.get("grid_id")
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        audience = data.get("audience", "general public")

        # Validate input parameters
        if not all([grid_id, start_time, end_time, audience]):
            return None, jsonify({
                "error": "Missing required parameters: grid_id, start_time, end_time, audience"
            }), 400

        # Fetch air quality data
        air_quality_data = DataFetcher.fetch_air_quality_data_a(grid_id, start_time, end_time)
        if air_quality_data is None:
            return None, jsonify({
                "error": "No data found for the given parameters"
            }), 404

        return data, air_quality_data, None
    @staticmethod
    def _handle_error(exception):
        return jsonify({
            "error": str(exception)
        }), 500

    @staticmethod
    def generate_air_quality_report_with_gemini():
        """Generate a report using Gemini model."""
        data, air_quality_data, error_response = ReportView._fetch_and_validate_request_data()
        if error_response:
            return error_response

        try:
            # Create an air quality report
            report = AirQualityReport(air_quality_data)
            # Generate the report with Gemini
            json_report = report.generate_report_with_gemini(data.get("audience", "general public"))

            if json_report is None:
                return jsonify({
                    "error": "Failed to generate report with Gemini"
                }), 500

            return jsonify({
                "report": json_report,
                "model": "gemini"
            }), 200

        except Exception as e:
            return ReportView._handle_error(e)

    @staticmethod
    def generate_air_quality_report_without_llm():
        """Generate a report without using LLM."""
        data, air_quality_data, error_response = ReportView._fetch_and_validate_request_data()
        if error_response:
            return error_response

        try:
            # Create an air quality report
            report = AirQualityReport(air_quality_data)
            # Generate the report without LLM
            json_report = report.generate_report_without_llm()

            if json_report is None:
                return jsonify({
                    "error": "Failed to generate report"
                }), 500

            return jsonify({
                "report": json_report,
                "model": "rule_based"
            }), 200

        except Exception as e:
            return ReportView._handle_error(e)
