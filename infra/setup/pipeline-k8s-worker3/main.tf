terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "3.5.0"
    }
  }
}

provider "google" {

  credentials = file("../AirQo-72961f2e56df.json")

  project = "airqo-250220"
  region  = "us-central1"
  zone    = "us-central1-c"
}

// A single Compute Engine instance
resource "google_compute_instance" "default" {
  name         = "pipeline-k8s-worker3"
  machine_type = "e2-small"
  zone         = "us-central1-c"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-1804-lts"
    }
  }

  network_interface {
    network = "pipeline-k8s-cluster"

    access_config {
      // Include this section to give the VM an external ip address
    }
  }

  metadata = {
    ssh-keys = "balmart:${file("~/.ssh/id_rsa.pub")}"
  }
}

output "ip" {
  value = google_compute_instance.default.network_interface.0.access_config.0.nat_ip
}
