resource "google_project_service" "street_view_image_backend_googleapis_com" {
  project = var.project-number
  service = "street-view-image-backend.googleapis.com"
}
# terraform import google_project_service.street_view_image_backend_googleapis_com ${var.project-number}/street-view-image-backend.googleapis.com
