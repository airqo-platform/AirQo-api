resource "google_project_service" "places_backend_googleapis_com" {
  project = "702081712633"
  service = "places-backend.googleapis.com"
}
# terraform import google_project_service.places_backend_googleapis_com 702081712633/places-backend.googleapis.com
