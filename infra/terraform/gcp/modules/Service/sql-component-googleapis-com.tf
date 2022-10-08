resource "google_project_service" "sql_component_googleapis_com" {
  project = var.project-number
  service = "sql-component.googleapis.com"
}
# terraform import google_project_service.sql_component_googleapis_com ${var.project-number}/sql-component.googleapis.com
