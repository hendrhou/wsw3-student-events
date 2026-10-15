# One PostgreSQL instance; one database + role per service (own-persistence
# semantics without four instances). Databases are provisioned by the
# bootstrap script documented in infra/README.md.

variable "project" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_sg_ids" {
  type        = list(string)
  description = "Security groups allowed to reach Postgres (the ECS services)"
}
variable "master_password" {
  type      = string
  sensitive = true
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "db" {
  name   = "${var.project}-db"
  vpc_id = var.vpc_id
  dynamic "ingress" {
    for_each = toset(var.allowed_sg_ids)
    content {
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "this" {
  identifier             = "${var.project}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  db_name                = "campuspulse"
  username               = "campus_pulse_admin"
  password               = var.master_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = true # course project; no production data
  tags                   = { Project = var.project }
}

output "endpoint" { value = aws_db_instance.this.endpoint }
output "security_group_id" { value = aws_security_group.db.id }
