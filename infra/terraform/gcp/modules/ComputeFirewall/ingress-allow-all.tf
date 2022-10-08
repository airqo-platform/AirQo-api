resource "google_compute_firewall" "ingress_allow_all" {
  allow {
    protocol = "all"
  }

  direction     = "INGRESS"
  name          = "ingress-allow-all"
  network       = "pipeline-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.ingress_allow_all projects/${var.project-id}/global/firewalls/ingress-allow-all
