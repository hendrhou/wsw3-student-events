// Package ontology holds the embedded Turtle documents loaded at boot:
// the domain ontology and the seed graph (loaded only into an empty store).
package ontology

import _ "embed"

//go:embed campus-pulse.ttl
var OntologyTTL string

//go:embed seed-events.ttl
var SeedEventsTTL string
