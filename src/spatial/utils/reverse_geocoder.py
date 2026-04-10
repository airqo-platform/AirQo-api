import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv
from geopy.exc import GeocoderServiceError, GeocoderTimedOut
from geopy.geocoders import Nominatim

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


class ReverseGeocoder:
    LOCATIONIQ_REVERSE_URL = "https://us1.locationiq.com/v1/reverse"

    def __init__(
        self,
        user_agent: str,
        nominatim_timeout: int = 5,
        locationiq_timeout: int = 5,
    ):
        self.geolocator = Nominatim(
            user_agent=user_agent, timeout=nominatim_timeout
        )
        self.locationiq_timeout = locationiq_timeout
        self.locationiq_access_token = os.getenv("LOCATIONIQ_ACCESS_TOKEN")
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def reverse(
        self,
        latitude: float,
        longitude: float,
        retries: int = 3,
        delay: int = 2,
        language: str = "en",
        exactly_one: bool = True,
        require_display_name: bool = False,
    ) -> Optional[Dict[str, Any]]:
        for attempt in range(retries):
            result = self._reverse_with_nominatim_attempt(
                latitude=latitude,
                longitude=longitude,
                language=language,
                exactly_one=exactly_one,
                retries=retries,
                attempt=attempt,
            )
            if self._is_usable_result(
                result, require_display_name=require_display_name
            ):
                return result

            if attempt == 0:
                backup_result = self._reverse_with_locationiq(
                    latitude=latitude,
                    longitude=longitude,
                    language=language,
                )
                if self._is_usable_result(
                    backup_result, require_display_name=require_display_name
                ):
                    return backup_result

            if attempt < retries - 1:
                time.sleep(delay * (2**attempt))

        return None

    def _reverse_with_nominatim_attempt(
        self,
        latitude: float,
        longitude: float,
        language: str,
        exactly_one: bool,
        retries: int,
        attempt: int,
    ) -> Optional[Dict[str, Any]]:
        try:
            location = self.geolocator.reverse(
                (latitude, longitude),
                exactly_one=exactly_one,
                language=language,
            )
            if location:
                raw = getattr(location, "raw", {}) or {}
                display_name = location.address or raw.get("display_name")
                address = raw.get("address", {})
                if not display_name and not address:
                    return None
                return {
                    "provider": "nominatim",
                    "display_name": display_name,
                    "address": address,
                }
        except (
            GeocoderTimedOut,
            GeocoderServiceError,
            requests.exceptions.RequestException,
        ) as exc:
            print(f"Geocoding error: {exc}, retry {attempt + 1}/{retries}")
        except Exception as exc:
            print(f"Unexpected geocoding error: {exc}")

        return None

    def _reverse_with_locationiq(
        self, latitude: float, longitude: float, language: str
    ) -> Optional[Dict[str, Any]]:
        if not self.locationiq_access_token:
            return None

        try:
            response = self.session.get(
                self.LOCATIONIQ_REVERSE_URL,
                params={
                    "key": self.locationiq_access_token,
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                    "addressdetails": 1,
                    "normalizeaddress": 1,
                    "accept-language": language,
                },
                timeout=self.locationiq_timeout,
            )
            response.raise_for_status()
            payload = response.json()
            return {
                "provider": "locationiq",
                "display_name": payload.get("display_name"),
                "address": payload.get("address", {}),
            }
        except requests.exceptions.RequestException as exc:
            print(f"LocationIQ geocoding error: {exc}")
        except ValueError as exc:
            print(f"LocationIQ response parsing error: {exc}")

        return None

    @staticmethod
    def _is_usable_result(
        result: Optional[Dict[str, Any]], require_display_name: bool = False
    ) -> bool:
        if not result:
            return False
        if require_display_name:
            return bool(result.get("display_name"))
        return bool(result.get("display_name") or result.get("address"))
