resource "google_service_account" "williambq" {
  account_id   = "williambq"
  description  = "for accessing BQ data"
  display_name = "williambq"
  project      = var.project-id
}
# terraform import google_service_account.williambq projects/${var.project-id}/serviceAccounts/williambq@airqo-250220.iam.gserviceaccount.com
