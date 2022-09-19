resource "google_storage_bucket" "airqo_mlflow_artifacts" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo-mlflow-artifacts"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_mlflow_artifacts airqo-mlflow-artifacts
