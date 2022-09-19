resource "google_storage_bucket" "gcf_sources_702081712633_us_central1" {
  cors {
    method = ["GET"]
    origin = ["https://*.cloud.google.com", "https://*.corp.google.com", "https://*.corp.google.com:*"]
  }

  force_destroy            = false
  location                 = "US-CENTRAL1"
  name                     = "gcf-sources-702081712633-us-central1"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.gcf_sources_702081712633_us_central1 gcf-sources-702081712633-us-central1
