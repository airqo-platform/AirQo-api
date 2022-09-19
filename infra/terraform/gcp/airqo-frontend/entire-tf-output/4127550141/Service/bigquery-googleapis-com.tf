resource "google_project_service" "bigquery_googleapis_com" {
  project = "4127550141"
  service = "bigquery.googleapis.com"
}
# terraform import google_project_service.bigquery_googleapis_com 4127550141/bigquery.googleapis.com
