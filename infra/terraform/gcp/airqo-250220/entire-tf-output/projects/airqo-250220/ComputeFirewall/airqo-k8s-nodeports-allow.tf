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
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_k8s_nodeports_allow projects/airqo-250220/global/firewalls/airqo-k8s-nodeports-allow
