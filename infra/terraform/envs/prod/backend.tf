# Remote state is intentionally NOT enabled yet — nothing here has been
# applied. When the first apply is planned:
#
# 1. Create the state bucket + lock table manually (one-time, see
#    infra/README.md), choosing names that are globally unique.
# 2. Uncomment the block below.
# 3. `terraform init -migrate-state`.
#
# terraform {
#   backend "s3" {
#     bucket         = "campus-pulse-tfstate-CHANGE-ME"
#     key            = "prod/terraform.tfstate"
#     region         = "eu-west-1"
#     dynamodb_table = "campus-pulse-tf-locks"
#     encrypt        = true
#   }
# }
