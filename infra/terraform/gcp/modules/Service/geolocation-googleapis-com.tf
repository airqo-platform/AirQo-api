resource "google_project_service" "geolocation_googleapis_com" {
  project = "${var.project-number}"
  service = "geolocation.googleapis.com"
}
# terraform import google_project_service.geolocation_googleapis_com ${var.project-number}/geolocation.googleapis.com
