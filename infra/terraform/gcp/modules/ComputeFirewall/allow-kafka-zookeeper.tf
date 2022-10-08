resource "google_compute_firewall" "allow_kafka_zookeeper" {
  allow {
    ports    = ["9092", "2181"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "allow-kafka-zookeeper"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "${var.project-id}"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_kafka_zookeeper projects/airqo-250220/global/firewalls/allow-kafka-zookeeper
