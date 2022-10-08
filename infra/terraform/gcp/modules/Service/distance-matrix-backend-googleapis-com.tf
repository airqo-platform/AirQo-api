resource "google_project_service" "distance_matrix_backend_googleapis_com" {
  project = "${var.project-number}"
  service = "distance-matrix-backend.googleapis.com"
}
# terraform import google_project_service.distance_matrix_backend_googleapis_com ${var.project-number}/distance-matrix-backend.googleapis.com
