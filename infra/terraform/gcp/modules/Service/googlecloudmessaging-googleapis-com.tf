resource "google_project_service" "googlecloudmessaging_googleapis_com" {
  project = var.project-number
  service = "googlecloudmessaging.googleapis.com"
}
# terraform import google_project_service.googlecloudmessaging_googleapis_com ${var.project-number}/googlecloudmessaging.googleapis.com
