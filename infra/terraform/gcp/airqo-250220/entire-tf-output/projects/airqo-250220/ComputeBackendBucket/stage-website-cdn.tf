resource "google_compute_backend_bucket" "stage_website_cdn" {
  bucket_name = "stage-airqo-website-files"

  cdn_policy {
    cache_mode  = "FORCE_CACHE_ALL"
    client_ttl  = 3600
    default_ttl = 3600
  }

  enable_cdn = true
  name       = "stage-website-cdn"
  project    = "airqo-250220"
}
# terraform import google_compute_backend_bucket.stage_website_cdn projects/airqo-250220/global/backendBuckets/stage-website-cdn
