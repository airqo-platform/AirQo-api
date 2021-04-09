resource "google_compute_instance" "airqo-controller-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  #count        = 2
  #name         = "${var.instance-name}-${count.index}"
  name         = var.instance-name["controller"]
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
      size  = var.disk_size["tiny"]
    }
  }

  metadata = {
    hostname = "${var.instance-name["controller"]}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_staging_network_subnetwork.name
    network_ip = "10.241.0.11"

    access_config {
      // Ephemeral IP
    }
  }
}

# add loadbalancer VM
resource "google_compute_instance" "airqo-loadbalancer-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  #count        = 2
  #name         = "${var.instance-name}-${count.index}"
  name         = var.instance-name["loadbalancer"]
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
      size  = var.disk_size["tiny"]
    }
  }

  metadata = {
    hostname = "${var.instance-name["loadbalancer"]}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_staging_network_subnetwork.name
    network_ip = "10.241.0.3"

    access_config {
      // Ephemeral IP
    }
  }
}

# add devops VM
resource "google_compute_instance" "airqo-devops-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  #count        = 2
  #name         = "${var.instance-name}-${count.index}"
  name         = var.instance-name["devops"]
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
      size  = var.disk_size["tiny"]
    }
  }

  metadata = {
    hostname = "${var.instance-name["devops"]}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_staging_network_subnetwork.name
    network_ip = "10.241.0.4"

    access_config {
      // Ephemeral IP
    }
  }
}

# add devops VM
resource "google_compute_instance" "airqo-db-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  #count        = 2
  #name         = "${var.instance-name}-${count.index}"
  name         = var.instance-name["db"]
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
      size  = var.disk_size["tiny"]
    }
  }

  metadata = {
    hostname = "${var.instance-name["db"]}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_staging_network_subnetwork.name
    network_ip = "10.241.0.5"

    access_config {
      // Ephemeral IP
    }
  }
}

resource "google_compute_instance" "airqo-staging-worker-instance" {

  ## for a setup having multiple instances of the same type, you can do
  ## the following, there would be 2 instances of the same configuration
  ## provisioned
  count        = 1
  name         = "${var.instance-name["worker"]}-${count.index}"
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
      size  = var.disk_size["tiny"]
    }
  }

  metadata = {
    hostname = "${var.instance-name["worker"]}-${count.index}.airqo.net"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.airqo_staging_network_subnetwork.name
    network_ip = "10.241.0.2${count.index}"

    access_config {
      // Ephemeral IP
    }
  }
}
