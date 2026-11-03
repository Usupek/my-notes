.PHONY: dev build up down logs migrate test lint fmt vet hooks hash-password

dev:
	docker compose up --build

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose run --rm migrate

test:
	cd services/api && go test ./...

lint:
	cd apps/web && npm run lint

fmt:
	cd services/api && gofmt -w ./cmd ./internal

vet:
	cd services/api && go vet ./...

hooks:
	lefthook install

hash-password:
	cd services/api && go run ./cmd/hashpassword
