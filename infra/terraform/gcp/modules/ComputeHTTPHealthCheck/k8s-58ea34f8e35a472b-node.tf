resource "google_compute_http_health_check" "k8s_58ea34f8e35a472b_node" {
  check_interval_sec  = 8
  description         = "{\"kubernetes.io/service-name\":\"k8s-58ea34f8e35a472b-node\"}"
  healthy_threshold   = 1
  name                = "k8s-58ea34f8e35a472b-node"
  port                = 10256
  project             = var.project-id
  request_path        = "/healthz"
  timeout_sec         = 1
  unhealthy_threshold = 3
}
# terraform import google_compute_http_health_check.k8s_58ea34f8e35a472b_node projects/${var.project-id}/global/httpHealthChecks/k8s-58ea34f8e35a472b-node
