resource "google_service_account" "map_backend" {
  account_id   = "map-backend"
  display_name = "map-backend"
  project      = "airqo-250220"
}
# terraform import google_service_account.map_backend projects/airqo-250220/serviceAccounts/map-backend@airqo-250220.iam.gserviceaccount.com
