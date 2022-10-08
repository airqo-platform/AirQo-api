resource "google_service_account" "mlflow_tracking_sa" {
  account_id   = "mlflow-tracking-sa"
  description  = "Service Account to run the MLFLow tracking server"
  display_name = "MLFlow tracking SA"
  project      = var.project-id
}
# terraform import google_service_account.mlflow_tracking_sa projects/${var.project-id}/serviceAccounts/mlflow-tracking-sa@${var.project-id}.iam.gserviceaccount.com
