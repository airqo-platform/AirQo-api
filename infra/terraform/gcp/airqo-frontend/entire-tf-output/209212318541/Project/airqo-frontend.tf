resource "google_project" "airqo_frontend" {
  auto_create_network = true
  billing_account     = "0104A4-EBBF6B-FE86F6"
  name                = "AirQo-Frontend"
  org_id              = "209212318541"
  project_id          = "airqo-frontend"
}
# terraform import google_project.airqo_frontend projects/airqo-frontend
