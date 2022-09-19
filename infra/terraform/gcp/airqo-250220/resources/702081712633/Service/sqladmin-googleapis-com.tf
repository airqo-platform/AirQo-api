resource "google_project_service" "sqladmin_googleapis_com" {
  project = "702081712633"
  service = "sqladmin.googleapis.com"
}
# terraform import google_project_service.sqladmin_googleapis_com 702081712633/sqladmin.googleapis.com
