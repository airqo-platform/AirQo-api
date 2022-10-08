resource "google_service_account" "map_backend" {
  account_id   = "map-backend"
  display_name = "map-backend"
  project      = var.project-id
}
# terraform import google_service_account.map_backend projects/${var.project-id}/serviceAccounts/map-backend@${var.project-id}.iam.gserviceaccount.com
