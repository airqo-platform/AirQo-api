resource "google_storage_bucket" "airqo_mlflow_artifacts" {
  force_destroy            = false
  location                 = var.location
  name                     = "airqo-mlflow-artifacts"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_mlflow_artifacts airqo-mlflow-artifacts
