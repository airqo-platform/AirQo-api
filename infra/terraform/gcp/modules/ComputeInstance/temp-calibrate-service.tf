resource "google_compute_instance" "temp_calibrate_service" {
  boot_disk {
    auto_delete = true
    device_name = "temp-calibrate-service"

    initialize_params {
      image = "ubuntu-2004-focal-v20220419"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/zones/europe-west1-b/disks/temp-calibrate-service"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "c2-standard-4"

  name = "temp-calibrate-service"

  network_interface {
    access_config {
      nat_ip       = "104.155.76.226"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
    network_ip         = "10.132.0.29"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/regions/europe-west1/subnetworks/default"
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
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.temp_calibrate_service projects/${var.project-id}/zones/europe-west1-b/instances/temp-calibrate-service
