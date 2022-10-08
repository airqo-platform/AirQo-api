resource "google_compute_firewall" "airqo_k8s_nodeports_allow" {
  allow {
    ports    = ["30000-32767"]
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  direction     = "INGRESS"
  name          = "airqo-k8s-nodeports-allow"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_k8s_nodeports_allow projects/${var.project-id}/global/firewalls/airqo-k8s-nodeports-allow
