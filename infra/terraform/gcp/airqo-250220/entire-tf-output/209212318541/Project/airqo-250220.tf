resource "google_project" "airqo_250220" {
  auto_create_network = true
  billing_account     = "0104A4-EBBF6B-FE86F6"
  name                = "AirQo"
  org_id              = "209212318541"
  project_id          = "airqo-250220"
}
# terraform import google_project.airqo_250220 projects/airqo-250220
