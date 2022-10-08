resource "google_compute_forwarding_rule" "a4bb5ca3836a011eab82442010a80006" {
  description           = "{\"kubernetes.io/service-name\":\"istio-system/istio-ingressgateway\"}"
  ip_address            = "104.197.176.102"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL"
  name                  = "a4bb5ca3836a011eab82442010a80006"
  network_tier          = "PREMIUM"
  port_range            = "80-31400"
  project               = var.project-id
  region                = "us-central1"
  target                = "https://www.googleapis.com/compute/beta/projects/${var.project-id}/regions/us-central1/targetPools/a4bb5ca3836a011eab82442010a80006"
}
# terraform import google_compute_forwarding_rule.a4bb5ca3836a011eab82442010a80006 projects/${var.project-id}/regions/us-central1/forwardingRules/a4bb5ca3836a011eab82442010a80006
