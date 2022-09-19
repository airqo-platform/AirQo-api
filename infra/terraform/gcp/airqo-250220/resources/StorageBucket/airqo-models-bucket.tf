resource "google_storage_bucket" "airqo_models_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo-models-bucket"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_models_bucket airqo-models-bucket
