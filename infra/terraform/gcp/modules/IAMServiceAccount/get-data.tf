resource "google_service_account" "get_data" {
  account_id   = "get-data"
  display_name = "get_data"
  project      = var.project-id
}
# terraform import google_service_account.get_data projects/${var.project-id}/serviceAccounts/get-data@${var.project-id}.iam.gserviceaccount.com
