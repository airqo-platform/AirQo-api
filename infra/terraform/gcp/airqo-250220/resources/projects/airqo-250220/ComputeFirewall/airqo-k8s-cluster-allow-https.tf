resource "google_compute_firewall" "airqo_k8s_cluster_allow_https" {
  allow {
    ports    = ["443"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "airqo-k8s-cluster-allow-https"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["https-server"]
}
# terraform import google_compute_firewall.airqo_k8s_cluster_allow_https projects/airqo-250220/global/firewalls/airqo-k8s-cluster-allow-https
