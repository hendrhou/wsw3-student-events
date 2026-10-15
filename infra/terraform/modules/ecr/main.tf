# One ECR repository per deployable image. Release pipeline pushes vX.Y.Z + sha.

variable "project" { type = string }
variable "repositories" { type = list(string) }

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.repositories)
  name                 = "${var.project}-${each.value}"
  image_tag_mutability = "MUTABLE" # sha tags move; releases are immutable by convention
  image_scanning_configuration { scan_on_push = true }
  tags = { Project = var.project }
}

resource "aws_ecr_lifecycle_policy" "keep_recent" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 20 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

output "repository_urls" { value = { for k, r in aws_ecr_repository.this : k => r.repository_url } }
