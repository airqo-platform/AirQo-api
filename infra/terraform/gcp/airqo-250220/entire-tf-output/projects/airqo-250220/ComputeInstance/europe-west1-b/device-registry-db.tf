resource "google_compute_instance" "device_registry_db" {
  boot_disk {
    auto_delete = true
    device_name = "device-registry-db"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210504"
      size  = 250
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/device-registry-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-custom-4-19712"

  name = "device-registry-db"

  network_interface {
    access_config {
      nat_ip       = "34.79.121.214"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.8"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

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
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["db-vm", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.device_registry_db projects/airqo-250220/zones/europe-west1-b/instances/device-registry-db
