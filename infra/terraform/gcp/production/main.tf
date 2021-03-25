resource "google_compute_instance" "airqo-controller-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  #count        = 2
  #name         = "${var.instance-name}-${count.index}"
  name         = var.controller-node-instance-name
  machine_type = var.vm_type["1point7gig"]

  zone = var.region

  tags = [
    "${var.network}-firewall-ssh",
    "${var.network}-firewall-http",
    "${var.network}-firewall-https",
    "${var.network}-firewall-icmp",
    "${var.network}-firewall-tcps",
    "${var.network}-firewall-secure-forward",
  ]

  boot_disk {
    initialize_params {
      image = var.os["ubuntu-1804"]
      size  = var.disk_size["large"]
    }
  }

  metadata = {
    hostname = "airqo-production-controller.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_production_network_subnetwork.name

    access_config {
      // Ephemeral IP
    }
  }
}

resource "google_compute_instance" "airqo-production-worker-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  count        = 2
  name         = "${var.worker-nodes-instance-name}-${count.index}"
  machine_type = var.vm_type["7point5gig"]

  zone = var.region

  tags = [
    "${var.network}-firewall-ssh",
    "${var.network}-firewall-http",
    "${var.network}-firewall-https",
    "${var.network}-firewall-icmp",
    "${var.network}-firewall-tcps",
    "${var.network}-firewall-secure-forward",
  ]

  boot_disk {
    initialize_params {
      image = var.os["ubuntu-1804"]
      size  = var.disk_size["large"]
    }
  }

  metadata = {
    hostname = "airqo-production-worker-${count.index}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_production_network_subnetwork.name

    access_config {
      // Ephemeral IP
    }
  }
}
