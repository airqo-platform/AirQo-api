# views/chatbot_views.py
from flask import request, jsonify
from models.chatbot_model import AirQualityChatbot, DataFetcher  
import logging
import uuid  # For generating session IDs if not provided

logger = logging.getLogger(__name__)

class ChatbotView:
    @staticmethod
    def chat_endpoint():
        """
        Handles chatbot API requests for air quality information with session management.
        Expects JSON payload with grid_id, start_time, end_time, prompt, and optional session_id, session_title.
        Returns JSON response with chatbot's answer and session metadata.
        """
        # Validate request payload
        payload = request.json
        required_fields = ["grid_id", "start_time", "end_time", "prompt"]
        if not payload or not all(key in payload for key in required_fields):
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
        
        # Session metadata (optional)
        session_id = payload.get("session_id", str(uuid.uuid4()))  # Generate if not provided
        
        # Automatically generate session_title from prompt (truncate to reasonable length)
        session_title = payload.get("session_title")  # Check if provided
        if not session_title:  # If not provided, generate from prompt
            session_title = (user_prompt[:50] + "...") if len(user_prompt) > 50 else user_prompt

        # Validate prompt
        if not user_prompt or not isinstance(user_prompt, str):
            logger.error(f"Invalid prompt received: {user_prompt}")
            return jsonify({
                "error": "No valid prompt provided",
                "status": "failure"
            }), 400

        try:
            # Fetch air quality data
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

            logger.info(f"Successfully processed request for {grid_id}, session_id: {session_id}")
            return jsonify({
                "response": response,
                "status": "success",
                "grid_id": grid_id,
                "period": {
                    "start_time": start_time,
                    "end_time": end_time
                },
                "session": {
                    "session_id": session_id,
                    "session_title": session_title,
                    "timestamp": start_time  # Optional: to track when the session started
                }
            }), 200

        except Exception as e:
            logger.error(f"Unhandled exception: {str(e)}")
            return jsonify({
                "error": "Internal server error", 
                "status": "failure"
            }), 500