resource "google_compute_firewall" "airqo_cicd_jenkins" {
  allow {
    ports    = ["8080"]
    protocol = "tcp"
  }

  description   = "Allow traffic on port 8080 for jenkins"
  direction     = "INGRESS"
  name          = "airqo-cicd-jenkins"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.airqo_cicd_jenkins projects/airqo-250220/global/firewalls/airqo-cicd-jenkins
