provider "google" {
  project = "airqo-frontend"
}


module "resources-projects-airqo-frontend-IAMServiceAccount" {
  source = "./resources/projects/airqo-frontend/IAMServiceAccount"
}


module "resources-projects-airqo-frontend-SQLInstance-us-central1" {
  source = "./resources/projects/airqo-frontend/SQLInstance/us-central1"
}


module "resources-projects-airqo-frontend-PubSubTopic" {
  source = "./resources/projects/airqo-frontend/PubSubTopic"
}


module "resources-projects-airqo-frontend-DNSManagedZone" {
  source = "./resources/projects/airqo-frontend/DNSManagedZone"
}


module "resources-projects-airqo-frontend-ComputeFirewall" {
  source = "./resources/projects/airqo-frontend/ComputeFirewall"
}


module "resources-projects-airqo-frontend-StorageBucket-US" {
  source = "./resources/projects/airqo-frontend/StorageBucket/US"
}


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "resources-4127550141-4127550141-Project-LoggingLogSink" {
#  source = "./resources/4127550141/4127550141/Project/LoggingLogSink"
# }


module "resources-4127550141-Service" {
  source = "./resources/4127550141/Service"
}


module "resources-projects-airqo-frontend-ComputeAddress-global" {
  source = "./resources/projects/airqo-frontend/ComputeAddress/global"
}

