package configuration

import "testing"

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(nil)
	if err != nil {
		t.Fatalf("no required vars → no error expected, got %v", err)
	}
	if cfg.Port != 8080 {
		t.Errorf("default port: got %d", cfg.Port)
	}
	if cfg.Env != "dev" {
		t.Errorf("default env: got %q", cfg.Env)
	}
}

func TestLoadFailsFastOnMissingRequired(t *testing.T) {
	_, err := Load([]string{"DATABASE_URL", "JWT_SECRET"})
	if err == nil {
		t.Fatal("expected error for missing vars")
	}
	for _, key := range []string{"DATABASE_URL", "JWT_SECRET"} {
		if !contains(err.Error(), key) {
			t.Errorf("error must name the missing var %q: %v", key, err)
		}
	}
}

func TestLoadValidatesPort(t *testing.T) {
	t.Setenv("PORT", "banana")
	if _, err := Load(nil); err == nil {
		t.Fatal("expected error for invalid PORT")
	}
	t.Setenv("PORT", "9090")
	cfg, err := Load(nil)
	if err != nil || cfg.Port != 9090 {
		t.Errorf("got %v, %v", cfg, err)
	}
}

func TestLoadReadsDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("APP_ENV", "prod")
	cfg, err := Load([]string{"DATABASE_URL"})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://x" || cfg.Env != "prod" {
		t.Errorf("got %+v", cfg)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
