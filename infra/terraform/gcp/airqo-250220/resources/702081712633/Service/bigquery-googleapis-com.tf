resource "google_project_service" "bigquery_googleapis_com" {
  project = "702081712633"
  service = "bigquery.googleapis.com"
}
# terraform import google_project_service.bigquery_googleapis_com 702081712633/bigquery.googleapis.com
