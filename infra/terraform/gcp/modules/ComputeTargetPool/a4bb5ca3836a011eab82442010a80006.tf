resource "google_compute_target_pool" "a4bb5ca3836a011eab82442010a80006" {
  description      = "{\"kubernetes.io/service-name\":\"istio-system/istio-ingressgateway\"}"
  health_checks    = ["https://www.googleapis.com/compute/beta/projects/${var.project-id}/global/httpHealthChecks/k8s-58ea34f8e35a472b-node"]
  instances        = ["us-central1-a/gke-airqo-k8s-cluster-default-pool-7a4c0b07-lj52", "us-central1-a/gke-airqo-k8s-cluster-default-pool-7a4c0b07-qw8c", "us-central1-a/gke-airqo-k8s-cluster-default-pool-7a4c0b07-swwx"]
  name             = "a4bb5ca3836a011eab82442010a80006"
  project          = var.project-id
  region           = "us-central1"
  session_affinity = "NONE"
}
# terraform import google_compute_target_pool.a4bb5ca3836a011eab82442010a80006 projects/${var.project-id}/regions/us-central1/targetPools/a4bb5ca3836a011eab82442010a80006
