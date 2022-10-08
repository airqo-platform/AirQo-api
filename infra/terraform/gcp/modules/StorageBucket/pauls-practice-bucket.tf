resource "google_storage_bucket" "pauls_practice_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "pauls-practice-bucket"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.pauls_practice_bucket pauls-practice-bucket
