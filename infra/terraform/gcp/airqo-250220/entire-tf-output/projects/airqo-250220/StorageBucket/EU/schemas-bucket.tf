resource "google_storage_bucket" "schemas_bucket" {
  force_destroy            = false
  location                 = "EU"
  name                     = "schemas-bucket"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.schemas_bucket schemas-bucket
