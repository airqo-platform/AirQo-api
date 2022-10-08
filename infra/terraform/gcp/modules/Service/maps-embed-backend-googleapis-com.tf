resource "google_project_service" "maps_embed_backend_googleapis_com" {
  project = var.project-number
  service = "maps-embed-backend.googleapis.com"
}
# terraform import google_project_service.maps_embed_backend_googleapis_com ${var.project-number}/maps-embed-backend.googleapis.com
