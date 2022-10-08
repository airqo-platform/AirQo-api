resource "google_storage_bucket" "fivetran_auth_bucket" {
  force_destroy            = false
  location                 = var.location
  name                     = "fivetran-auth-bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.fivetran_auth_bucket fivetran-auth-bucket
