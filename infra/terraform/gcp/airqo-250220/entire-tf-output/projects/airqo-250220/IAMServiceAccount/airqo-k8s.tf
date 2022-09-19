resource "google_service_account" "airqo_k8s" {
  account_id   = "airqo-k8s"
  description  = "This service account gives required permission to airqo-k8s-controller"
  display_name = "airqo-k8s"
  project      = "airqo-250220"
}
# terraform import google_service_account.airqo_k8s projects/airqo-250220/serviceAccounts/airqo-k8s@airqo-250220.iam.gserviceaccount.com
