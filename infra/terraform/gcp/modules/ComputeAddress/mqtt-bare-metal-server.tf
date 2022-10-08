resource "google_compute_address" "mqtt_bare_metal_server" {
  address_type = "EXTERNAL"
  name         = "mqtt-bare-metal-server"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.mqtt_bare_metal_server projects/${var.project-id}/regions/europe-west2/addresses/mqtt-bare-metal-server
