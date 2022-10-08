resource "google_project_service" "maps_android_backend_googleapis_com" {
  project = var.project-number
  service = "maps-android-backend.googleapis.com"
}
# terraform import google_project_service.maps_android_backend_googleapis_com ${var.project-number}/maps-android-backend.googleapis.com
