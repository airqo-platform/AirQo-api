resource "google_project_service" "apigee_googleapis_com" {
  project = var.project-number
  service = "apigee.googleapis.com"
}
# terraform import google_project_service.apigee_googleapis_com ${var.project-number}/apigee.googleapis.com
