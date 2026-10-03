# Campus Pulse — Student Event Management System

> ⚠️ **Status: Beta placeholder.** This repository currently holds scaffolding only. It
> exists to populate the course project repo early; architecture, code and documentation
> will be built out iteratively over the semester. Nothing here is final.

## Context

This project is being developed for the **Semantic Web and Web 3.0** course unit
(Master's Degree in Computer Engineering, 1st year / 1st semester, Faculty of Science
and Technology, Universidade Fernando Pessoa, 2026/2027).

It implements the mandatory technical requirements (R1–R10) defined in the course
project protocol: a distributed solution integrating **microservices**, **micro
frontends**, a **Semantic Web** layer (OWL ontology + RDF + SPARQL) and a **Web 3.0**
component.

## Use case

**Domain:** Higher education and learning pathways — a student event management
system for a university campus, covering event discovery, registration/ticketing,
attendance and participation records across clubs, departments and external
organisers.

Heterogeneous data sources to be integrated (see [docs/agents/domain.md](docs/agents/domain.md)-style
notes to follow as the ontology work starts):

- Internal event catalogue (created/managed by student clubs and departments).
- Academic programme / course unit data, to relate events to study plans and
  learning outcomes.
- An external open data or linked data source (e.g. Wikidata) for institution,
  location or competence enrichment.

Core concepts to model (draft, subject to change once the ontology is formalised in
Protégé): `Event`, `Organiser`, `Venue`, `Participant`, `Registration`, `Competence`.

Intended Web 3.0 component (draft): event attendance / participation certificates
issued as verifiable credentials, so a student's participation record can be checked
by a third party without querying a central university system.

## Planned architecture

| Layer | Technology | Status |
|---|---|---|
| Microservices | Go + Gin | Not started |
| API gateway | TBD | Not started |
| Micro frontends | React | Not started |
| Semantic layer | OWL (Protégé) + RDF + SPARQL | Not started |
| Web 3.0 component | Smart contract / verifiable credential (test network) | Not started |
| Orchestration | Docker + Docker Compose | Not started |

A full architecture diagram and service breakdown will be added once the use-case
proposal is approved.

## Repository layout (planned)

```
student-event-system/
  services/        # Go/Gin microservices (one directory per service)
  frontend/        # React micro frontends
  ontology/        # OWL ontology files + reasoner validation reports
  semantic/        # RDF transformations, SPARQL queries
  web3/            # Smart contract / DID / verifiable credential code
  docs/            # Technical documentation chapters
  docker-compose.yml
```

This structure does not exist yet — it is the intended shape once development starts.

## Getting started

Not available yet. A single documented start-up command (`docker compose up`) will be
added once the first service is containerised.

## Status

This is an early placeholder commit only. Check back after the intermediate delivery
milestone for a working architecture, a first running service and an initial domain
ontology.
:
