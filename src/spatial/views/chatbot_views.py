from flask import request, jsonify
# Assuming these are in models/chatbot_model.py based on the import
from models.chatbot_model import AirQualityChatbot, DataFetcher  
import numpy as np
import logging

#logging.basicConfig(filename="report_log.log", level=logging.INFO, filemode="w")
logger = logging.getLogger(__name__)

class ChatbotView:
    @staticmethod
    def chat_endpoint():
        """
        Handles chatbot API requests for air quality information
        Expects JSON payload with grid_id, start_time, end_time, and prompt
        Returns JSON response with chatbot's answer or error message
        """
        # Validate request payload
        payload = request.json
        if not payload or not all(key in payload for key in ["grid_id", "start_time", "end_time", "prompt"]):
            logger.error("Invalid payload: missing required fields")
            return jsonify({
                "error": "Missing required fields: grid_id, start_time, end_time, prompt",
                "status": "failure"
            }), 400

        # Extract parameters
        grid_id = payload["grid_id"]
        start_time = payload["start_time"]
        end_time = payload["end_time"]
        user_prompt = payload["prompt"]

        # Validate prompt
        if not user_prompt or not isinstance(user_prompt, str):
            logger.error(f"Invalid prompt received: {user_prompt}")
            return jsonify({
                "error": "No valid prompt provided",
                "status": "failure"
            }), 400

        try:
            # Fetch air quality data with logging
            logger.info(f"Fetching data for grid_id: {grid_id}, {start_time} to {end_time}")
            air_quality_data = DataFetcher.fetch_air_quality_data(grid_id, start_time, end_time)
            
            if not air_quality_data or 'airquality' not in air_quality_data:
                logger.error(f"No valid air quality data returned for grid_id: {grid_id}")
                return jsonify({
                    "error": "Failed to fetch air quality data",
                    "status": "failure"
                }), 500

            # Initialize chatbot and get response
            chatbot = AirQualityChatbot(air_quality_data)
            response = chatbot.chat(user_prompt)
            
            if not response:
                logger.warning(f"Empty response generated for prompt: {user_prompt}")
                return jsonify({
                    "error": "No response generated",
                    "status": "failure"
                }), 500

            logger.info(f"Successfully processed request for {grid_id}")
            return jsonify({
                "response": response,
                "status": "success",
                "grid_id": grid_id,
                "period": {
                    "start_time": start_time,
                    "end_time": end_time
                }
            }), 200

        except Exception as e:
            logger.error(f"Unhandled exception: {str(e)}")
            return jsonify({
                "error": "Internal server error", 
                "status": "failure"
            }), 500
