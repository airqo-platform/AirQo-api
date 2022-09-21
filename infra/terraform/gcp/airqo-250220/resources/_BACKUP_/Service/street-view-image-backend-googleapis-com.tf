resource "google_project_service" "street_view_image_backend_googleapis_com" {
  project = "702081712633"
  service = "street-view-image-backend.googleapis.com"
}
# terraform import google_project_service.street_view_image_backend_googleapis_com 702081712633/street-view-image-backend.googleapis.com
