resource "google_project_service" "fcm_googleapis_com" {
  project = "${var.project-number}"
  service = "fcm.googleapis.com"
}
# terraform import google_project_service.fcm_googleapis_com ${var.project-number}/fcm.googleapis.com
