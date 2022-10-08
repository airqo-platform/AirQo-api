resource "google_compute_instance" "device_mornitoring_db" {
  boot_disk {
    auto_delete = true
    device_name = "device-mornitoring-db"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210514"
      size  = 250
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/device-mornitoring-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-custom-2-2304"

  name = "device-mornitoring-db"

  network_interface {
    access_config {
      nat_ip       = "34.140.46.94"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.10"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "${var.project-id}"
  }

  project = "${var.project-id}"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.device_mornitoring_db projects/airqo-250220/zones/europe-west1-b/instances/device-mornitoring-db
