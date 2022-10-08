resource "google_project_service" "fcmregistrations_googleapis_com" {
  project = var.project-number
  service = "fcmregistrations.googleapis.com"
}
# terraform import google_project_service.fcmregistrations_googleapis_com ${var.project-number}/fcmregistrations.googleapis.com
