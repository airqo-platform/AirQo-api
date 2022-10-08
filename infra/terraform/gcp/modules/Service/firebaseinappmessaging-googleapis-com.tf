resource "google_project_service" "firebaseinappmessaging_googleapis_com" {
  project = "${var.project-number}"
  service = "firebaseinappmessaging.googleapis.com"
}
# terraform import google_project_service.firebaseinappmessaging_googleapis_com ${var.project-number}/firebaseinappmessaging.googleapis.com
