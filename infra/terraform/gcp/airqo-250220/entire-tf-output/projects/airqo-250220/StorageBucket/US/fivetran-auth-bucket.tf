resource "google_storage_bucket" "fivetran_auth_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "fivetran-auth-bucket"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.fivetran_auth_bucket fivetran-auth-bucket
