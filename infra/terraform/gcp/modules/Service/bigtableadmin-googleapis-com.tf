resource "google_project_service" "bigtableadmin_googleapis_com" {
  project = "702081712633"
  service = "bigtableadmin.googleapis.com"
}
# terraform import google_project_service.bigtableadmin_googleapis_com 702081712633/bigtableadmin.googleapis.com
