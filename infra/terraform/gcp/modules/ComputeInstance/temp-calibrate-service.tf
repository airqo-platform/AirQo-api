resource "google_compute_instance" "temp_calibrate_service" {
  boot_disk {
    auto_delete = true
    device_name = "temp-calibrate-service"

    initialize_params {
      image = var.os["ubuntu-focal"]
      size  = var.disk_size["tiny"]
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "temp-calibrate-service"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "c2-standard-4"

  name = "temp-calibrate-service"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "default"
    network_ip         = "10.132.0.29"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "default"
    subnetwork_project = var.project-id
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
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["default-allow-http", "http-server", "https-server"]
  zone = var.zone
}
# terraform import google_compute_instance.temp_calibrate_service projects/${var.project-id}/zones/europe-west1-b/instances/temp-calibrate-service
