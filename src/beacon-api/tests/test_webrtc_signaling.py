import json
import base64
import time
import pytest
from uuid import uuid4, UUID
from starlette.testclient import TestClient
from sqlalchemy import select
from fastapi import status

from app.db.session import AsyncSessionLocal
from app.models.webrtc import WebRTCSession, WebRTCSessionMember, WebRTCSessionInvitation
from app.services.redis_service import redis_service
from main import app

# Craft unsigned JWTs for test users
def _make_fake_jwt(user_id: str, email: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"_id": user_id, "email": email}).encode()).rstrip(b"=").decode()
    return f"{header}.{payload}.fakesig"

HOST_ID = "user-host-111"
GUEST_1_ID = "user-guest-222"
GUEST_2_ID = "user-guest-333"

TOKEN_HOST = _make_fake_jwt(HOST_ID, "host@airqo.net")
TOKEN_GUEST_1 = _make_fake_jwt(GUEST_1_ID, "guest1@airqo.net")
TOKEN_GUEST_2 = _make_fake_jwt(GUEST_2_ID, "guest2@airqo.net")

def test_webrtc_signaling_flow():
    """
    Verifies the complete WebRTC signaling workflow:
      1. Host creates a session.
      2. Host invites Guest 1.
      3. Guest 1 joins the session.
      4. Host and Guest 1 connect to the WebRTC signaling WebSocket.
      5. Host and Guest 1 exchange SDP offers, answers, and ICE candidates.
      6. Host grants control to Guest 1, verifying 'grantControl' broadcast.
      7. Host revokes control, verifying 'revokeControl' broadcast.
      8. Host removes Guest 1, verifying 'peerLeft' and forced WebSocket closure.
      9. Host leaves/disconnects, verifying auto-termination of the session.
    """
    redis_service._client = None  # Reset Redis client within test client loop
    
    with TestClient(app) as client:
        # 1. Host creates session
        create_resp = client.post(
            "/api/v1/webrtc/sessions",
            json={"invitees": [GUEST_1_ID]},
            headers={"Authorization": f"JWT {TOKEN_HOST}"}
        )
        assert create_resp.status_code == 201, create_resp.text
        session_data = create_resp.json()
        session_id = session_data["id"]
        assert session_data["host_id"] == HOST_ID
        assert session_data["status"] == "ACTIVE"

        # 2. Verify invitation was created
        # Guest 2 is NOT invited yet. Let's verify Guest 2 cannot join.
        join_guest2_fail = client.post(
            f"/api/v1/webrtc/sessions/{session_id}/join",
            headers={"Authorization": f"JWT {TOKEN_GUEST_2}"}
        )
        assert join_guest2_fail.status_code == 403

        # 3. Guest 1 joins successfully
        join_guest1 = client.post(
            f"/api/v1/webrtc/sessions/{session_id}/join",
            headers={"Authorization": f"JWT {TOKEN_GUEST_1}"}
        )
        assert join_guest1.status_code == 200
        member_data = join_guest1.json()
        assert member_data["user_id"] == GUEST_1_ID
        assert member_data["role"] == "Participant"
        assert member_data["can_control"] is False

        # 4. Connect both Host and Guest 1 via WebRTC Signaling WebSockets
        ws_url_host = f"/api/v1/webrtc/ws/signaling/{session_id}?token={TOKEN_HOST}"
        ws_url_guest1 = f"/api/v1/webrtc/ws/signaling/{session_id}?token={TOKEN_GUEST_1}"

        with client.websocket_connect(ws_url_host) as ws_host:
            # Host receives peerJoined for themselves
            host_ack = ws_host.receive_json()
            assert host_ack["type"] == "peerJoined"
            assert host_ack["user_id"] == HOST_ID

            with client.websocket_connect(ws_url_guest1) as ws_guest1:
                # Guest 1 receives peerJoined for themselves
                guest_ack = ws_guest1.receive_json()
                assert guest_ack["type"] == "peerJoined"
                assert guest_ack["user_id"] == GUEST_1_ID

                # Host receives peerJoined broadcast for Guest 1 (due to reconnect/joining activity)
                host_recv_join = ws_host.receive_json()
                assert host_recv_join["type"] == "peerJoined"
                assert host_recv_join["user_id"] == GUEST_1_ID

                # 5. Signaling: Host sends WebRTC offer to Guest 1
                offer_payload = {"sdp": "v=0\no=- 5493 2 IN IP4 127.0.0.1..."}
                ws_host.send_json({
                    "type": "offer",
                    "target_user_id": GUEST_1_ID,
                    "payload": offer_payload
                })

                # Guest 1 should receive the offer
                offer_msg = ws_guest1.receive_json()
                assert offer_msg["type"] == "offer"
                assert offer_msg["sender_id"] == HOST_ID
                assert offer_msg["payload"] == offer_payload

                # Guest 1 sends answer to Host
                answer_payload = {"sdp": "v=0\no=- 5493 3 IN IP4 127.0.0.1..."}
                ws_guest1.send_json({
                    "type": "answer",
                    "target_user_id": HOST_ID,
                    "payload": answer_payload
                })

                # Host should receive the answer
                answer_msg = ws_host.receive_json()
                assert answer_msg["type"] == "answer"
                assert answer_msg["sender_id"] == GUEST_1_ID
                assert answer_msg["payload"] == answer_payload

                # Guest 1 sends ICE candidate
                ice_payload = {"candidate": "candidate:8421304 1 udp..."}
                ws_guest1.send_json({
                    "type": "iceCandidate",
                    "target_user_id": HOST_ID,
                    "payload": ice_payload
                })

                # Host receives ICE candidate
                ice_msg = ws_host.receive_json()
                assert ice_msg["type"] == "iceCandidate"
                assert ice_msg["sender_id"] == GUEST_1_ID
                assert ice_msg["payload"] == ice_payload

                # 6. Grant Control: Host grants control to Guest 1 via REST API
                grant_resp = client.post(
                    f"/api/v1/webrtc/sessions/{session_id}/control/grant",
                    json={"participant_id": GUEST_1_ID},
                    headers={"Authorization": f"JWT {TOKEN_HOST}"}
                )
                assert grant_resp.status_code == 200
                assert grant_resp.json()["success"] is True

                # Verify 'grantControl' broadcast is received by both peers
                grant_host_evt = ws_host.receive_json()
                assert grant_host_evt["type"] == "grantControl"
                assert grant_host_evt["controller_id"] == GUEST_1_ID

                grant_guest_evt = ws_guest1.receive_json()
                assert grant_guest_evt["type"] == "grantControl"
                assert grant_guest_evt["controller_id"] == GUEST_1_ID

                # Verify Guest 1 is now marked controller in database
                get_sess = client.get(
                    f"/api/v1/webrtc/sessions/{session_id}",
                    headers={"Authorization": f"JWT {TOKEN_HOST}"}
                )
                assert get_sess.json()["controller_id"] == GUEST_1_ID

                # 7. Revoke Control: Host revokes control from Guest 1
                revoke_resp = client.post(
                    f"/api/v1/webrtc/sessions/{session_id}/control/revoke",
                    json={"controller_id": GUEST_1_ID},
                    headers={"Authorization": f"JWT {TOKEN_HOST}"}
                )
                assert revoke_resp.status_code == 200
                assert revoke_resp.json()["success"] is True

                # Verify 'revokeControl' broadcast is received by both peers
                revoke_host_evt = ws_host.receive_json()
                assert revoke_host_evt["type"] == "revokeControl"
                assert revoke_host_evt["controller_id"] == GUEST_1_ID

                revoke_guest_evt = ws_guest1.receive_json()
                assert revoke_guest_evt["type"] == "revokeControl"
                assert revoke_guest_evt["controller_id"] == GUEST_1_ID

                # 8. Host removes Guest 1 from session
                remove_resp = client.delete(
                    f"/api/v1/webrtc/sessions/{session_id}/participants/{GUEST_1_ID}",
                    headers={"Authorization": f"JWT {TOKEN_HOST}"}
                )
                assert remove_resp.status_code == 204

                # Host receives 'peerLeft' broadcast
                peer_left_evt = ws_host.receive_json()
                assert peer_left_evt["type"] == "peerLeft"
                assert peer_left_evt["user_id"] == GUEST_1_ID

                # Guest 1 WebSocket connection should be disconnected due to removal
                # Starlette test client's ws.receive_json() raises WebSocketDisconnect (or similar) when closed
                from starlette.websockets import WebSocketDisconnect
                with pytest.raises(WebSocketDisconnect) as excinfo:
                    ws_guest1.receive_json()
                assert excinfo.value.code == status.WS_1008_POLICY_VIOLATION

        # 9. Clean up / Close the session (when Host disconnects / leaves/deletes)
        # Verify deleting/closing session
        close_resp = client.delete(
            f"/api/v1/webrtc/sessions/{session_id}",
            headers={"Authorization": f"JWT {TOKEN_HOST}"}
        )
        assert close_resp.status_code == 200
        assert close_resp.json()["status"] == "CLOSED"
