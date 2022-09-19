resource "google_storage_bucket" "gcf_sources_702081712633_europe_west2" {
  cors {
    method = ["GET"]
    origin = ["https://*.cloud.google.com", "https://*.corp.google.com", "https://*.corp.google.com:*"]
  }

  force_destroy               = false
  location                    = "EUROPE-WEST2"
  name                        = "gcf-sources-702081712633-europe-west2"
  project                     = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention    = "inherited"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}
# terraform import google_storage_bucket.gcf_sources_702081712633_europe_west2 gcf-sources-702081712633-europe-west2
