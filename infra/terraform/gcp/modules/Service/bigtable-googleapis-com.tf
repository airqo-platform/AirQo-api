resource "google_project_service" "bigtable_googleapis_com" {
  project = var.project-number
  service = "bigtable.googleapis.com"
}
# terraform import google_project_service.bigtable_googleapis_com ${var.project-number}/bigtable.googleapis.com
