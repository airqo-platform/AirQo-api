resource "google_project_service" "containeranalysis_googleapis_com" {
  project = var.project-number
  service = "containeranalysis.googleapis.com"
}
# terraform import google_project_service.containeranalysis_googleapis_com ${var.project-number}/containeranalysis.googleapis.com
