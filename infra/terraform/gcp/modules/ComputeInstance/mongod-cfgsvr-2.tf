resource "google_compute_instance" "mongod_cfgsvr_2" {
  boot_disk {
    auto_delete = true
    source      = "mongod-cfgsvr-2"
  }

  labels = {
    "env"  = "prod"
    "type" = "mongo-config-server"
  }

  machine_type = "e2-custom-4-8192"

  metadata = {
    startup-script = "sudo ufw allow ssh"
  }

  name = "mongod-cfgsvr-2"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network = "default"
    network_ip = "10.132.0.48"
  }

  project = var.project_id

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project_number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  zone = var.zone
}
# terraform import google_compute_instance.mongod_cfgsvr_2 projects/${var.project_id}/zones/${var.zone}/instances/mongod-cfgsvr-2
