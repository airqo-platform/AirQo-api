resource "google_project_service" "roads_googleapis_com" {
  project = "${var.project-number}"
  service = "roads.googleapis.com"
}
# terraform import google_project_service.roads_googleapis_com ${var.project-number}/roads.googleapis.com
