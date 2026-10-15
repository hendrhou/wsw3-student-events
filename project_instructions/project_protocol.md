# Project Protocol — Semantic Web and Web 3.0 (2026/2027)

> Source: `WSW3_Project protocol (EN)_2026-27.pdf`
> Course unit: Semantic Web and Web 3.0 — Master's Degree in Computer Engineering,
> 1st year / 1st semester, Faculty of Science and Technology, Universidade Fernando Pessoa.
>
> This file is the authoritative project brief for any agent working in this
> repository. All code, architecture and documentation decisions MUST be checked
> against it. When a decision conflicts with this file, flag it to the user
> instead of silently proceeding.

## 1. Project frame

- Practical project = the **laboratory practice and project component** of the course unit.
- Deliverable: a **distributed solution** integrating microservices, micro frontends,
  Semantic Web and Web 3.0 technologies, technically documented and defended in a
  public presentation with individual discussion.
- Learning outcomes addressed: LO1, LO2, LO4 and (integratively) LO6.
- **Mandatory to pass**: minimum mark of 9.5/20 (no rounding) in the weighted
  average of project + defence. Cannot be replaced by an exam.
- Access to the final exam requires that minimum **plus 75% attendance** of
  laboratory practice hours.

## 2. This repository's use case

**Campus Pulse — Student Event Management System** (domain: higher education and
learning pathways — cf. protocol §4.10): student event management for a university
campus — event discovery, registration/ticketing, attendance and participation
records across clubs, departments and external organisers.

- Data sources (planned): internal event catalogue; academic programme / course
  unit data; an external open/linked data source (e.g. Wikidata) for enrichment.
- Core concepts (draft): `Event`, `Organiser`, `Venue`, `Participant`,
  `Registration`, `Competence`.
- Web 3.0 component (draft): attendance/participation certificates as **verifiable
  credentials**, checkable by a third party without querying a central system.

Use-case acceptance criteria (protocol §3): enough **heterogeneous data sources**,
concepts with relationships that **justify an ontology**, and a Web 3.0 component
whose relevance the group can **defend honestly** (state limitations plainly).

### 2.1 Agreed architecture (starting point — refine in the week-2 proposal)

**Microservices (R1/R2 — Go/Gin, REST/JSON, each with its own persistence):**

| Service | Responsibility |
|---------|----------------|
| `kong` (API gateway) | Single entry point; routing to services. **Kong**, running as a container in the same Docker Compose network (decided 2026-10-03). Note: the gateway is infrastructure, not one of the R1 microservices — the Go/Gin count comes from the five services below |
| `user-service` | Users, roles (student/organiser), interests |
| `event-service` | Events, dates, locations, capacities |
| `registration-service` | Registrations, available places, check-in |
| `semantic-service` | Integrates heterogeneous sources into RDF, serves the ontology and SPARQL (event recommendations) |
| `ticket-service` | Issues and verifies digital tickets — hosts the **Web 3.0 component** (mechanism TBD: verifiable credential preferred over NFT; must be justified honestly per §8 of the protocol) |

**Micro frontends (R5 — React, composed into a shell, role-based auth + state):**

- `student-mfe` — event discovery/recommendations, registration, my tickets & credentials
- `organiser-mfe` — event creation/management, registration tracking, check-in

**Orchestration (R3):** every component — Kong, the five Go services, the React
shell + MFEs, the RDF store, databases — runs as a container managed by a single
`docker-compose.yml` with one documented start-up command.

**R7 data sources (≥2 heterogeneous → RDF, aligned to the ontology):**
internal event catalogue, academic programme/course-unit data, and optionally
Wikidata for enrichment (institutions, locations, competences).

## 3. Mandatory technical requirements (R1–R10)

Every piece of work in this repo must converge to satisfying ALL of these:

| No. | Requirement | Syllabus |
|-----|-------------|----------|
| R1 | Microservices architecture: **minimum 3 services** with distinct responsibilities, defined inter-service communication, single entry point (API gateway or equivalent) | CP1 |
| R2 | Microservices in **Go with Gin**: routing, middleware, REST/JSON interface, persistence | CP1 |
| R3 | **Containerise everything**; local orchestration with Docker + Docker Compose; **single documented start-up command** | CP1 |
| R4 | **Event logging** and **automated tests** covering at minimum the critical paths of two services | CP1 |
| R5 | **React micro-frontend architecture**: minimum 2 integrated micro frontends, state management, authentication | CP2 |
| R6 | **Domain ontology in OWL, built in Protégé**: class hierarchy, properties, restrictions; **validated by a reasoner without inconsistencies** | CP3 |
| R7 | **Transform ≥2 heterogeneous sources to RDF**, aligned to the domain ontology | CP3 |
| R8 | Expose semantic data through a microservice with **≥5 SPARQL queries** answering relevant domain questions | CP3 |
| R9 | **Web 3.0 component** integrated into the architecture (smart contract on test network / dApp / decentralised identity) with a written justification of relevance | CP4 |
| R10 | Version control with **regular history and identifiable contributions**, Dockerfiles, complete technical documentation | CP1–CP5 |

**Valued but not mandatory** (quality differentiators — prefer when cheap):
async messaging between services; resilience patterns; federated querying of
external linked data; reuse/alignment with public vocabularies; micro-frontend
composition via **Module Federation**; CI in the repository.

## 4. Deliveries and deadlines

| Delivery | When | Content |
|----------|------|---------|
| Proposal | Week 2 | 2-page document: use case, data sources, preliminary service decomposition, intended Web 3.0 component. Not graded, but **approval is a precondition for development**. |
| Intermediate | Week 7 (supervision session) | Architecture defined; **first Go/Gin service containerised and running**; first ontology version in Protégé (class hierarchy, main properties, labels); work plan for 2nd half of semester. |
| Final | Week 15 | Working distributed solution, source code, Dockerfiles, complete technical documentation. |
| Defence | Week 15 | Public presentation + demo + **individual discussion per member**. |

Submission mechanics:
- Institutional learning platform, **by 23:59 on the due day**.
- Submit: repository link + **tag of the delivered version** + technical documentation PDF.
- Late: **−2 marks per working day**, not accepted after 3 working days.
- Weeks 7 and 13 are supervision sessions (by appointment, per group). Week 15 = final delivery + presentations.

## 5. Technical documentation (mandatory structure)

Language: Portuguese or English. PDF. **Max 25 pages of body text** (cover, TOC and
appendices excluded). Must state upfront how work was distributed among members.
Code excerpts only when strictly needed to support a statement.

| Ch. | Title | Length | Content |
|-----|-------|--------|---------|
| 1 | Use case and requirements | 2 pp. | Domain, problem, functional/non-functional requirements, explicitly excluded scope |
| 2 | Architecture of the solution | 3–4 pp. | Service decomposition + responsibilities, communication, entry point, diagram, justification |
| 3 | Go/Gin microservices | 3 pp. | Structure of each service, REST interface, persistence, error handling, event logging |
| 4 | Containerisation and execution | 2 pp. | Images, orchestration, config variables, start-up procedure |
| 5 | Micro frontends | 2–3 pp. | Composition pattern, micro frontends, service integration, state, authentication |
| 6 | Domain ontology | 3–4 pp. | Methodology, classes, properties, restrictions, modelling decisions, reasoner validation outcome |
| 7 | Semantic data integration | 3 pp. | Sources, RDF transformation, ontology alignment, SPARQL queries + results |
| 8 | Web 3.0 component | 2 pp. | Solution, architectural integration, relevance justification |
| 9 | Testing and validation | 1–2 pp. | Strategy, tests, coverage, results |
| 10 | Limitations and future work | 1 p. | What was left undone, difficulties, critical review |
| 11 | Use of AI tools | 0.5 p. | Tools used, specific scope of use, how the outcome was verified |

## 6. Defence: what every member must be able to do

Any agent-generated artefact must remain explainable by every group member:

- Explain **any part** of the submitted artefacts (service code, micro frontends,
  Dockerfiles, ontology) — including parts they did not write.
- Justify decomposition, ontology modelling and data integration decisions.
- **Run a SPARQL query or make a small change live** on lecturer request.
- Justify the relevance of the Web 3.0 component.

## 7. Assessment

Component = 60% of the final course mark: intermediate 15% + final 35% +
presentation/defence 10%. Remaining 40% = comprehensive final examination (CFE).

**Final mark:** $NF = 0.40 \times CFE + 0.50 \times PP + 0.10 \times PD$

### Intermediate delivery (15%)
| Criterion | Weight |
|---|---|
| Architecture defined (coherent decomposition, adequate communication) | 30% |
| First service running (Go/Gin, containerised, usable REST, documented start-up) | 30% |
| First ontology version (concept coverage, properties w/ domain+range, labels/notes) | 25% |
| Work plan (realism, task distribution, risks) | 15% |

### Final delivery (35%)
| Criterion | Weight |
|---|---|
| Working solution (R1–R10 fulfilled, actual operation, layer integration) | 35% |
| Code & containerisation quality (organisation, readability, error handling, logging, tests, reproducibility) | 25% |
| Semantic layer (ontology quality, source alignment correctness, SPARQL relevance) | 25% |
| Technical documentation (11 chapters, rigour, justification, language) | 15% |

### Presentation and defence (10%)
| Criterion | Weight |
|---|---|
| Presentation and demonstration (clarity, demo quality, time management — ~20 min) | 40% |
| Individual discussion (command of artefacts, reasoning, live changes) | 60% |

## 8. Rules that constrain how agents must work here

- **AI tool use is permitted but must be declared** (documentation chapter 11:
  tools, scope of use, how output was verified). Undeclared use / inability to
  justify authorship in the discussion is treated as fraud/plagiarism.
  → Keep a running record of what AI generated and how it was verified.
- No reused work from other course units or previous years; no solutions that
  merely reproduce technology-vendor examples.
- Groups of 2–3; the repository history must show **each member's identifiable
  contributions** → commit as the actual author, with regular history (no dumps).
- Recovery: if the 9.5 minimum is missed, a revised project + new defence is
  allowed up to 5 working days before the resit exam, capped at 14/20.
- Nothing in the protocol overrides the course unit outline or assessment regulations.

## 9. Final delivery checklist (definition of done)

- [ ] Repository accessible to the lecturer, with the delivered version **tagged** and history from all members
- [ ] Complete solution starts with a **single command from a clean environment**, as documented
- [ ] Sample environment-variables file and demo credentials for each user profile
- [ ] Ontology as an OWL file + reasoner validation report
- [ ] Set of SPARQL queries with expected results
- [ ] Web 3.0 component running on a test network, with access instructions
- [ ] Automated tests running in full without failures
- [ ] Technical documentation PDF with all 11 chapters + work distribution
- [ ] R1–R10 verified one by one
