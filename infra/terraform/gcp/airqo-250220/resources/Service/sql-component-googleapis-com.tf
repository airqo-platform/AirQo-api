resource "google_project_service" "sql_component_googleapis_com" {
  project = "702081712633"
  service = "sql-component.googleapis.com"
}
# terraform import google_project_service.sql_component_googleapis_com 702081712633/sql-component.googleapis.com
