resource "google_compute_instance" "pipeline_k8s_controller" {
  boot_disk {
    auto_delete = true
    device_name = "pipeline-k8s-controller"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220712"
      size  = 50
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/pipeline-k8s-controller"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "n2-standard-2"

  metadata = {
    ssh-keys = "noah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDCGCRMDn3GciJ6EG+uATxHo+FDpOVq9EOcmExdTtcOOb0utD0ayJk7m8cNY9jc2UHphXDAONweRKbhCbMhswQ31ho4im7Gq+373wUGTfsz1AWriupo52AubAAup1tjYeKQrIZ//4R6mw4yx8J98QRWKp2EZwHvw+9ke/3HwWlLEsfhFhLLdCrSG4Slv84djn0MXi40tlAHz8YKlNB88DrMAHwzfdjWnzqIemTcluwwDH2ts6E5LdCVlNLHoocYZudduKxFhcCBBtXR0DpzgKccXQzEN5fdxySPxrcdi9jjTtjYhVBrA3XYAC3kwqdVDClOQzTfA5TfVSGdgYIO5Zyufa9i95W+M+OlnuoiB1zUdOG5GppdUGXUAt9BNO6UY+s/lHKr1/pg26rppSXzwHnS7fEijIrPTpfxRISSsyxuBWjwEcmX7CV9FLjgrzhMd0tUPLHpuR4StbmYrwqfIZXrCN5nOomQPlx4dyacGU+rAWeu0XF0ZvBpxZiMwnTUhfU= noah@Noahs-MacBook.local\nnoah:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBGO93wyeev2dCo27Lqycf/QUsdeHvxrRfDrzyEGRl4edPC6NBCqUeUzGOFibyXsTXrstEMMXvVU0q/THUrizWPw= google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-08-03T07:58:43+0000\"}\nnoah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAHlBTTnXqeCZWx9Y9BCFtZIcI/UOEDn8xY1E8lpx6Z9+3vkgImdoqXfPpQaTr3rBbQvp26Uub9GlIhBayomtP3ZGSCJtjrlbROcTLT0rmo+VkOR/gnUC6op3Kfs6mS9HL68uNePnB0W7ts7LQTOWrUK0dHxGNL2P6Ug+wLvaKM85EGUR/iOqxzbobDsgV1I3bLsQFty8I4tERSdo5LQOz2anafJAq/Ouhip8w+jA1DkwwaLebE80l13zwfpUyq8IAdxUuj6UVT4RGULBIE0j+TflSPbQgLkFGJLIC/HkqNpPzWAeahyJD+XtaJAcv+nhGdcJd66hbbnRC5Lesl6NN78= google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-08-03T07:59:39+0000\"}"
  }

  name = "pipeline-k8s-controller"

  network_interface {
    access_config {
      nat_ip       = "34.140.20.232"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/pipeline-k8s-cluster"
    network_ip         = "10.132.0.14"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/pipeline-k8s-cluster"
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

  tags = ["http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.pipeline_k8s_controller projects/airqo-250220/zones/europe-west1-b/instances/pipeline-k8s-controller
