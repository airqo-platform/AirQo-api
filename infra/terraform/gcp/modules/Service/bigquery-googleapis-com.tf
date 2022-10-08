resource "google_project_service" "bigquery_googleapis_com" {
  project = "${var.project-number}"
  service = "bigquery.googleapis.com"
}
# terraform import google_project_service.bigquery_googleapis_com ${var.project-number}/bigquery.googleapis.com
