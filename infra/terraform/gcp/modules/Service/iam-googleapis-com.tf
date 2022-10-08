resource "google_project_service" "iam_googleapis_com" {
  project = var.project-number
  service = "iam.googleapis.com"
}
# terraform import google_project_service.iam_googleapis_com ${var.project-number}/iam.googleapis.com
