resource "google_compute_firewall" "datalab_network_allow_ssh" {
  allow {
    ports    = ["22"]
    protocol = "tcp"
  }

  description   = "Allow SSH access to Datalab instances"
  direction     = "INGRESS"
  name          = "datalab-network-allow-ssh"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/datalab-network"
  priority      = 1000
  project       = "${var.project-id}"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.datalab_network_allow_ssh projects/airqo-250220/global/firewalls/datalab-network-allow-ssh
