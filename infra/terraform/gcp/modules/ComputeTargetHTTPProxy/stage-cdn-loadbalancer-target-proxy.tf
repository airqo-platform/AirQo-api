resource "google_compute_target_http_proxy" "stage_cdn_loadbalancer_target_proxy" {
  name    = "stage-cdn-loadbalancer-target-proxy"
  project = var.project-id
  url_map = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/urlMaps/stage-cdn-loadbalancer"
}
# terraform import google_compute_target_http_proxy.stage_cdn_loadbalancer_target_proxy projects/${var.project-id}/global/targetHttpProxies/stage-cdn-loadbalancer-target-proxy
