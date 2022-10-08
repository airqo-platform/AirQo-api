resource "google_storage_bucket" "airqo_250220_terraform_state" {
  force_destroy = false
  location      = var.location
  name          = "${var.project-id}-terraform-state"
  project       = var.project-id
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
}
# terraform import google_storage_bucket.${var.project-id}_terraform_state airqo-250220-terraform-state
