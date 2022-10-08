resource "google_project_service" "firebasedynamiclinks_googleapis_com" {
  project = var.project-number
  service = "firebasedynamiclinks.googleapis.com"
}
# terraform import google_project_service.firebasedynamiclinks_googleapis_com ${var.project-number}/firebasedynamiclinks.googleapis.com
