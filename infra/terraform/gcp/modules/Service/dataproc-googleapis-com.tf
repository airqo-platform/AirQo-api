resource "google_project_service" "dataproc_googleapis_com" {
  project = var.project-number
  service = "dataproc.googleapis.com"
}
# terraform import google_project_service.dataproc_googleapis_com ${var.project-number}/dataproc.googleapis.com
