resource "google_service_account" "interactive_map" {
  account_id   = "interactive-map"
  display_name = "interactive-map"
  project      = "${var.project-id}"
}
# terraform import google_service_account.interactive_map projects/airqo-250220/serviceAccounts/interactive-map@airqo-250220.iam.gserviceaccount.com
