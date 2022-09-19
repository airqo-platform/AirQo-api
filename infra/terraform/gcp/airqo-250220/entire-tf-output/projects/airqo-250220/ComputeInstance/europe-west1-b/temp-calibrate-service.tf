resource "google_compute_instance" "temp_calibrate_service" {
  boot_disk {
    auto_delete = true
    device_name = "temp-calibrate-service"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220419"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/temp-calibrate-service"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "c2-standard-4"

  metadata = {
    ssh-keys = "noah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDCGCRMDn3GciJ6EG+uATxHo+FDpOVq9EOcmExdTtcOOb0utD0ayJk7m8cNY9jc2UHphXDAONweRKbhCbMhswQ31ho4im7Gq+373wUGTfsz1AWriupo52AubAAup1tjYeKQrIZ//4R6mw4yx8J98QRWKp2EZwHvw+9ke/3HwWlLEsfhFhLLdCrSG4Slv84djn0MXi40tlAHz8YKlNB88DrMAHwzfdjWnzqIemTcluwwDH2ts6E5LdCVlNLHoocYZudduKxFhcCBBtXR0DpzgKccXQzEN5fdxySPxrcdi9jjTtjYhVBrA3XYAC3kwqdVDClOQzTfA5TfVSGdgYIO5Zyufa9i95W+M+OlnuoiB1zUdOG5GppdUGXUAt9BNO6UY+s/lHKr1/pg26rppSXzwHnS7fEijIrPTpfxRISSsyxuBWjwEcmX7CV9FLjgrzhMd0tUPLHpuR4StbmYrwqfIZXrCN5nOomQPlx4dyacGU+rAWeu0XF0ZvBpxZiMwnTUhfU= noah@Noahs-MacBook.local"
  }

  name = "temp-calibrate-service"

  network_interface {
    access_config {
      nat_ip       = "104.155.76.226"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
    network_ip         = "10.132.0.29"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/default"
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
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["default-allow-http", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.temp_calibrate_service projects/airqo-250220/zones/europe-west1-b/instances/temp-calibrate-service
