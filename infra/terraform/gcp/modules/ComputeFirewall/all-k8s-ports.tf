resource "google_compute_firewall" "all_k8s_ports" {
  allow {
    ports    = ["30000-32767"]
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  direction     = "INGRESS"
  name          = "all-k8s-ports"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/pipeline-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.all_k8s_ports projects/${var.project-id}/global/firewalls/all-k8s-ports
