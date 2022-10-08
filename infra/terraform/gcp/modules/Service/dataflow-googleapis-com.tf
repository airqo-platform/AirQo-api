resource "google_project_service" "dataflow_googleapis_com" {
  project = var.project-number
  service = "dataflow.googleapis.com"
}
# terraform import google_project_service.dataflow_googleapis_com ${var.project-number}/dataflow.googleapis.com
