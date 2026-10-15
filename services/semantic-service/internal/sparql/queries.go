package sparql

import (
	"fmt"
	"strings"
)

// The semantic-service SPARQL query catalogue (R8: ≥5 queries answering domain
// questions). Every query is a plain string constant — reviewable, explainable
// in the defence, and covered by tests through a fake client.

const Prefixes = `
PREFIX cp: <https://campus-pulse.ufp.pt/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`

// Q1: "Which events match this student's interests?" — the recommendation driver.
func RecommendationsForUser(userURI string) string {
	return Prefixes + fmt.Sprintf(`
SELECT DISTINCT ?event ?title ?topicLabel WHERE {
  <%s> cp:hasInterest ?interest .
  ?event a cp:Event ; cp:hasTopic ?interest ; cp:eventTitle ?title .
  ?interest cp:topicLabel ?topicLabel .
} ORDER BY ?title
LIMIT 5`, userURI)
}

// Q2: "Which interest concepts match a search string?" (ontology combobox).
func SearchInterests(q string) string {
	escaped := strings.ToLower(strings.ReplaceAll(q, `"`, `\"`))
	return Prefixes + fmt.Sprintf(`
SELECT ?topic ?label WHERE {
  ?topic a cp:Topic ; cp:topicLabel ?label .
  FILTER(CONTAINS(LCASE(?label), "%s"))
} ORDER BY ?label`, escaped)
}

// Q3: "Which events cover a given topic?" (related events / explainability).
func EventsByTopic(topicURI string) string {
	return Prefixes + fmt.Sprintf(`
SELECT ?event ?title WHERE {
  ?event a cp:Event ; cp:hasTopic <%s> ; cp:eventTitle ?title .
} ORDER BY ?title`, topicURI)
}

// Q4: "What topics does an event cover?" (drives the 'Why this?' explanation).
func TopicsForEvent(eventURI string) string {
	return Prefixes + fmt.Sprintf(`
SELECT ?topic ?label WHERE {
  <%s> cp:hasTopic ?topic . ?topic cp:topicLabel ?label .
} ORDER BY ?label`, eventURI)
}

// Q5: "What are this student's interest labels?" (profile explanations).
func UserInterestLabels(userURI string) string {
	return Prefixes + fmt.Sprintf(`
SELECT ?label WHERE {
  <%s> cp:hasInterest ?t . ?t cp:topicLabel ?label .
} ORDER BY ?label`, userURI)
}
