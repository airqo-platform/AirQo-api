resource "google_compute_firewall" "airqo_k8s_allow_external" {
  allow {
    ports    = ["22", "6443", "9090"]
    protocol = "tcp"
  }

  allow {
    protocol = "icmp"
  }

  direction     = "INGRESS"
  name          = "airqo-k8s-allow-external"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_k8s_allow_external projects/airqo-250220/global/firewalls/airqo-k8s-allow-external
