resource "google_compute_firewall" "airqo_cicd_jenkins" {
  allow {
    ports    = ["8080"]
    protocol = "tcp"
  }

  description   = "Allow traffic on port 8080 for jenkins"
  direction     = "INGRESS"
  name          = "airqo-cicd-jenkins"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_cicd_jenkins projects/${var.project-id}/global/firewalls/airqo-cicd-jenkins
