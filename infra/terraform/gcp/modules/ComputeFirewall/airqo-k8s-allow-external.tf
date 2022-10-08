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
  network       = "airqo-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_k8s_allow_external projects/${var.project-id}/global/firewalls/airqo-k8s-allow-external
