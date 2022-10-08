resource "google_service_account" "airqo_k8s" {
  account_id   = "airqo-k8s"
  description  = "This service account gives required permission to airqo-k8s-controller"
  display_name = "airqo-k8s"
  project      = var.project-id
}
# terraform import google_service_account.airqo_k8s projects/${var.project-id}/serviceAccounts/airqo-k8s@${var.project-id}.iam.gserviceaccount.com
