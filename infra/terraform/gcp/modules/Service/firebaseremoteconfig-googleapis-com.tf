resource "google_project_service" "firebaseremoteconfig_googleapis_com" {
  project = "${var.project-number}"
  service = "firebaseremoteconfig.googleapis.com"
}
# terraform import google_project_service.firebaseremoteconfig_googleapis_com ${var.project-number}/firebaseremoteconfig.googleapis.com
