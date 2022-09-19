resource "google_service_account" "airqo_frontend" {
  account_id   = "airqo-frontend"
  display_name = "App Engine default service account"
  project      = "airqo-frontend"
}
# terraform import google_service_account.airqo_frontend projects/airqo-frontend/serviceAccounts/airqo-frontend@airqo-frontend.iam.gserviceaccount.com
