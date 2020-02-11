.DEFAULT_GOAL := build

VERSION?=latest
PORT?=8080

compile:
	npm run build

build: compile
	docker build -t spirogov/agent-js:${VERSION} .

push:
	docker push spirogov/agent-js:${VERSION}

start:
	docker run -p ${PORT}:8080 spirogov/agent-js:${VERSION}