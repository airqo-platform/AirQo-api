resource "google_storage_bucket" "schemas_bucket" {
  force_destroy            = false
  location                 = "${var.location}"
  name                     = "schemas-bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.schemas_bucket schemas-bucket
