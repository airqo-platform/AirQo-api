resource "google_project_service" "bigquerydatatransfer_googleapis_com" {
  project = var.project-number
  service = "bigquerydatatransfer.googleapis.com"
}
# terraform import google_project_service.bigquerydatatransfer_googleapis_com ${var.project-number}/bigquerydatatransfer.googleapis.com
