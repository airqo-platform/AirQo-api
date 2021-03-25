variable "region" {
  default = "europe-west1-b" # Belgium
}
variable "project-name" {
  default = "airqo-250220"
}

variable "subnetwork-region" {
  default = "europe-west1"
}

variable "network" {
  default = "airqo-production-cluster"
}

variable "vm_type" {
  default = {
    "512gig"     = "f1-micro"
    "1point7gig" = "g1-small"
    "7point5gig" = "n1-standard-2"
  }
}

variable "worker-nodes-instance-name" {
  default = "airqo-production-worker"
}
variable "controller-node-instance-name" {
  default = "airqo-production-contoller"
}

variable "os" {
  default = {
    "centos7"         = "centos-7-v20170816"
    "debian9"         = "debian-9-stretch-v20170816"
    "ubuntu-1604-lts" = "ubuntu-1604-xenial-v20170815a"
    "ubuntu-1704"     = "ubuntu-1704-zesty-v20170811"
    "ubuntu-1804"     = "ubuntu-1804-bionic-v20200916"
  }
}

variable "disk_size" {
  default = {
    "tiny"   = "10"
    "small"  = "20"
    "medium" = "100"
    "large"  = "200"
  }
}
