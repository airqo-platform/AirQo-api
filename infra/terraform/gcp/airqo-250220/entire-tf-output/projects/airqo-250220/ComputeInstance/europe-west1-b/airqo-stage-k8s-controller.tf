resource "google_compute_instance" "airqo_stage_k8s_controller" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210720"
      size  = 100
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-controller"
  }

  can_ip_forward = true
  machine_type   = "e2-standard-2"

  metadata = {
    ssh-keys = "noah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDCGCRMDn3GciJ6EG+uATxHo+FDpOVq9EOcmExdTtcOOb0utD0ayJk7m8cNY9jc2UHphXDAONweRKbhCbMhswQ31ho4im7Gq+373wUGTfsz1AWriupo52AubAAup1tjYeKQrIZ//4R6mw4yx8J98QRWKp2EZwHvw+9ke/3HwWlLEsfhFhLLdCrSG4Slv84djn0MXi40tlAHz8YKlNB88DrMAHwzfdjWnzqIemTcluwwDH2ts6E5LdCVlNLHoocYZudduKxFhcCBBtXR0DpzgKccXQzEN5fdxySPxrcdi9jjTtjYhVBrA3XYAC3kwqdVDClOQzTfA5TfVSGdgYIO5Zyufa9i95W+M+OlnuoiB1zUdOG5GppdUGXUAt9BNO6UY+s/lHKr1/pg26rppSXzwHnS7fEijIrPTpfxRISSsyxuBWjwEcmX7CV9FLjgrzhMd0tUPLHpuR4StbmYrwqfIZXrCN5nOomQPlx4dyacGU+rAWeu0XF0ZvBpxZiMwnTUhfU= noah@Noahs-MacBook.local\nnoah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC00p9BNFVjsg9lvNJlMQh5mBALNpS/YkiO7UI7jTSrbPEYZ0u5VdoVSmL7WD3foKtc7UcYNBbnoMrzAFWKe+r56X6qhafes2cX6fSSBD6LRkM7PrxzNc0fjOxSVC4kisewW+SopG1DNztLwVTD62rLzojoig1hTyt5lQwGUG5B0MX/bNQGddC9kCZM/Z4KQ/tD6VqCgx8D3Yj6d7VP+j8zj1SDlVIQwSLhtE5xn5cQgLeanKR7ss9Jti8SVznEkZtUldT5sLloY/hrIg8mwQ5GbXsjwM18NRf1FzcX1SMHXI11LyirOhkv1xQS5S6ZYMMjExIopQmLMEjr1nmg4AI6GQRYw/hKZqpWGVHa4s/M/Ex9/68YIRUhI4x5jQ0dnYQGEf/amNY7CqNWocYnQYfdnRCesZqL8NxnryMElcQ74NS46bAqLobXRN7NpQztggRLakywo/ZMX6w7dVqqjx7A1HUwLtclECOPogaXYM9pVWO1goa0oBezdqCZ/ITknL8= noah@Noahs-MacBook-Air.local\ndaniel:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBDmvzoxrXLI7+ZHBX0HPNflPmEgg8hcfwJA8MOWxCS41RNeh/SQa+Pv3cBH+McF6kBySbo57ei0ax2t0zdBS8RU= google-ssh {\"userName\":\"daniel@airqo.net\",\"expireOn\":\"2022-08-10T05:03:18+0000\"}\ndaniel:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDMTnXX95okmmKAp97qL8OysKys2FU81F7eQlPVPaEx4OgP31AQfpgnEC1JcJ6/t7g6xxpuFreVf4SK5eb5I9SUI42vB/T6sskQ2DAJaRdeSzvEYuBg8ULg+cFQzkM6pINTaIH96N87pgb8coc4N/gK6Kzfk2h/dlir7wlj9EC+zio8d//XwMEqbceZAmqnqgBtAsRjf+xzKtyroZtfjdthgzNBgtKBvKAAPWCkXwSDjjMFOqWknAnEV6gJbgxfy9LrrETVlYZVMSCYut7yv+bz+vjNWU2S8q7Kf/RFB6vV3jtMQBjcL5MNLMi5oSAcp4cH0G99SBhtvTCLH29+8XJL google-ssh {\"userName\":\"daniel@airqo.net\",\"expireOn\":\"2022-08-10T05:03:33+0000\"}"
  }

  name = "airqo-stage-k8s-controller"

  network_interface {
    access_config {
      nat_ip       = "104.155.124.180"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.100"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s-cluster", "controller"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_stage_k8s_controller projects/airqo-250220/zones/europe-west1-b/instances/airqo-stage-k8s-controller
