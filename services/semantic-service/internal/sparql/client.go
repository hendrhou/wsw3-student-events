// Package sparql is the Fuseki client: SELECT/ASK queries and Turtle updates
// over HTTP (SPARQL 1.1 protocol), with basic auth for the Fuseki admin user.
package sparql

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	QueryURL  string
	UpdateURL string
	User      string
	Password  string
	HTTP      *http.Client
}

func NewClient(queryURL, updateURL, user, password string) *Client {
	return &Client{
		QueryURL: queryURL, UpdateURL: updateURL,
		User: user, Password: password,
		HTTP: &http.Client{Timeout: 10 * time.Second},
	}
}

// Binding is one SPARQL result row: variable name → value.
type Binding map[string]string

type resultsDoc struct {
	Results struct {
		Bindings []map[string]struct {
			Type  string `json:"type"`
			Value string `json:"value"`
		} `json:"bindings"`
	} `json:"results"`
}

// Select runs a SELECT query and returns flattened bindings.
func (c *Client) Select(ctx context.Context, query string) ([]Binding, error) {
	form := url.Values{"query": {query}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.QueryURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/sparql-results+json")
	if c.User != "" {
		req.SetBasicAuth(c.User, c.Password)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sparql query: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("sparql query: status %d: %s", resp.StatusCode, body)
	}
	var doc resultsDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}
	out := make([]Binding, 0, len(doc.Results.Bindings))
	for _, b := range doc.Results.Bindings {
		row := Binding{}
		for k, v := range b {
			row[k] = v.Value
		}
		out = append(out, row)
	}
	return out, nil
}

// IsEmpty reports whether the dataset has any triples (used to seed once).
func (c *Client) IsEmpty(ctx context.Context) (bool, error) {
	rows, err := c.Select(ctx, "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }")
	if err != nil {
		return false, err
	}
	return len(rows) == 0 || rows[0]["n"] == "0", nil
}

// LoadTurtle uploads Turtle content to the default graph.
func (c *Client) LoadTurtle(ctx context.Context, turtle string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.UpdateURL, strings.NewReader(turtleUpdate(turtle)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/sparql-update")
	if c.User != "" {
		req.SetBasicAuth(c.User, c.Password)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("sparql update: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("sparql update: status %d: %s", resp.StatusCode, body)
	}
	return nil
}

// turtleUpdate wraps Turtle triples in a SPARQL INSERT DATA update. SPARQL
// Update does not accept Turtle "@prefix" directives, so they are hoisted and
// rewritten as SPARQL "PREFIX" declarations before the update body.
func turtleUpdate(turtle string) string {
	var prefixes, triples []string
	for _, line := range strings.Split(turtle, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "@prefix") {
			body := strings.TrimSuffix(strings.TrimPrefix(trimmed, "@prefix"), ".")
			prefixes = append(prefixes, "PREFIX"+body)
			continue
		}
		if strings.HasPrefix(trimmed, "@base") || trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		triples = append(triples, line)
	}
	return strings.Join(prefixes, "\n") + "\nINSERT DATA {\n" + strings.Join(triples, "\n") + "\n}"
}

// EnsureDataset creates the dataset when missing (Fuseki admin API).
func EnsureDataset(ctx context.Context, fusekiBase, name, user, password string) error {
	form := url.Values{"dbName": {name}, "dbType": {"tdb2"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(fusekiBase, "/")+"/$/datasets", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if user != "" {
		req.SetBasicAuth(user, password)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	// 200 created, 409 already exists — both fine
	if resp.StatusCode != 200 && resp.StatusCode != 409 {
		return fmt.Errorf("create dataset: status %d", resp.StatusCode)
	}
	return nil
}
