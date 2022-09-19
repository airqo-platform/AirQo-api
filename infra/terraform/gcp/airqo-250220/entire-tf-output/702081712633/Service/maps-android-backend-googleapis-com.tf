resource "google_project_service" "maps_android_backend_googleapis_com" {
  project = "702081712633"
  service = "maps-android-backend.googleapis.com"
}
# terraform import google_project_service.maps_android_backend_googleapis_com 702081712633/maps-android-backend.googleapis.com
