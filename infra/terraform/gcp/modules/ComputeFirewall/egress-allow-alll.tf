resource "google_compute_firewall" "egress_allow_alll" {
  allow {
    protocol = "all"
  }

  destination_ranges = ["0.0.0.0/0"]
  direction          = "EGRESS"
  name               = "egress-allow-alll"
  network       = "pipeline-k8s-cluster"
  priority           = 1000
  project            = var.project-id
}
# terraform import google_compute_firewall.egress_allow_alll projects/${var.project-id}/global/firewalls/egress-allow-alll
