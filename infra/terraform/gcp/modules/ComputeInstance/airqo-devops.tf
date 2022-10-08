resource "google_compute_instance" "airqo_devops" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-devops"

    initialize_params {
      image = var.os["ubuntu-xenial"]
      size  = var.disk_size["large"]
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "airqo-devops"
  }

  machine_type = "custom-1-7424-ext"

  metadata = {
    startup-script = "sudo ufw allow ssh"
  }

  name = "airqo-devops"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "default"
    network_ip         = "10.128.0.62"
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

  tags = ["http-server", "https-server"]
  zone = var.zone
}
# terraform import google_compute_instance.airqo_devops projects/${var.project-id}/zones/us-central1-a/instances/airqo-devops
