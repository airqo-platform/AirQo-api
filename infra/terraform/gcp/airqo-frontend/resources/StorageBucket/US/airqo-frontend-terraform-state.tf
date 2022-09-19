resource "google_storage_bucket" "airqo_frontend_terraform_state" {
  force_destroy = false
  location      = "US"
  name          = "airqo-frontend-terraform-state"
  project       = "airqo-frontend"
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
}
# terraform import google_storage_bucket.airqo_frontend_terraform_state airqo-frontend-terraform-state
