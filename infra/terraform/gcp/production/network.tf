resource "google_compute_network" "airqo_production_network" {
  name                    = var.network
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "airqo_production_network_subnetwork" {
  name          = "${var.network}-subnetwork-${var.subnetwork-region}"
  region        = var.subnetwork-region
  network       = google_compute_network.airqo_production_network.self_link
  ip_cidr_range = "10.242.0.0/16"
}
