resource "google_compute_url_map" "stage_cdn_loadbalancer" {
  default_service = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/backendBuckets/stage-website-cdn"

  host_rule {
    hosts        = ["staging.airqo.net"]
    path_matcher = "path-matcher-1"
  }

  name = "stage-cdn-loadbalancer"

  path_matcher {
    default_service = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/backendBuckets/stage-website-cdn"
    name            = "path-matcher-1"
  }

  project = "airqo-250220"
}
# terraform import google_compute_url_map.stage_cdn_loadbalancer projects/airqo-250220/global/urlMaps/stage-cdn-loadbalancer
