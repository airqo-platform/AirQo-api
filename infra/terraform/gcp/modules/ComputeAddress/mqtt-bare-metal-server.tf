resource "google_compute_address" "mqtt_bare_metal_server" {
  address      = "35.197.216.243"
  address_type = "EXTERNAL"
  name         = "mqtt-bare-metal-server"
  network_tier = "PREMIUM"
  project      = "${var.project-id}"
  region       = "europe-west2"
}
# terraform import google_compute_address.mqtt_bare_metal_server projects/airqo-250220/regions/europe-west2/addresses/mqtt-bare-metal-server
