provider "google" {
  project = "airqo-frontend"
}


module "resources-projects-airqo-frontend-IAMServiceAccount" {
  source = "./resources/IAMServiceAccount"
}


module "resources-projects-airqo-frontend-SQLInstance" {
  source = "./resources/SQLInstance"
}


module "resources-projects-airqo-frontend-PubSubTopic" {
  source = "./resources/PubSubTopic"
}


module "resources-projects-airqo-frontend-DNSManagedZone" {
  source = "./resources/DNSManagedZone"
}


module "resources-projects-airqo-frontend-ComputeFirewall" {
  source = "./resources/ComputeFirewall"
}


module "resources-projects-airqo-frontend-StorageBucket-US" {
  source = "./resources/StorageBucket"
}


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "resources-a-required" {
#  source = "./resources/a-required.tf"
# }


module "resources-4127550141-Service" {
  source = "./resources/Service"
}


module "resources-projects-airqo-frontend-ComputeAddress" {
  source = "./resources/ComputeAddress"
}

