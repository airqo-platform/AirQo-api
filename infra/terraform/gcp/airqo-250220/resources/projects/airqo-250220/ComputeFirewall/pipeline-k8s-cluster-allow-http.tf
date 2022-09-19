resource "google_compute_firewall" "pipeline_k8s_cluster_allow_http" {
  allow {
    ports    = ["80"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "pipeline-k8s-cluster-allow-http"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server"]
}
# terraform import google_compute_firewall.pipeline_k8s_cluster_allow_http projects/airqo-250220/global/firewalls/pipeline-k8s-cluster-allow-http
