resource "google_storage_bucket" "airqo_250220_cloudbuild" {
  force_destroy            = false
  location                 = var.location
  name                     = "${var.project-id}_cloudbuild"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.${var.project-id}_cloudbuild airqo-250220_cloudbuild
