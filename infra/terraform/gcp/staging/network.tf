resource "google_compute_network" "airqo_staging_network" {
  name                    = var.network
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "airqo_staging_network_subnetwork" {
  name          = "${var.network}-subnetwork-${var.subnetwork-region}"
  region        = var.subnetwork-region
  network       = google_compute_network.airqo_staging_network.self_link
  ip_cidr_range = "10.241.0.0/16"
}
