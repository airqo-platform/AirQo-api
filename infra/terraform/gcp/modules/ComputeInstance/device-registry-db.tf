resource "google_compute_instance" "device_registry_db" {
  boot_disk {
    auto_delete = true
    device_name = "device-registry-db"

    initialize_params {
      image = var.os["ubuntu-bionic"]
      size  = var.disk_size["large"]
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "device-registry-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-custom-4-19712"

  name = "device-registry-db"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "airqo-k8s-cluster"
    network_ip         = "10.240.0.8"
  }

  project = var.project-id

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["db-vm", "http-server", "https-server"]
  zone = var.zone
}
# terraform import google_compute_instance.device_registry_db projects/${var.project-id}/zones/europe-west1-b/instances/device-registry-db
