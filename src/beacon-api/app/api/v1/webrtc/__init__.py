from fastapi import APIRouter
from app.api.v1.webrtc import session_controller, participant_controller, signaling_controller

webrtc_router = APIRouter()

webrtc_router.include_router(session_controller.router)
webrtc_router.include_router(participant_controller.router)
webrtc_router.include_router(signaling_controller.router)
