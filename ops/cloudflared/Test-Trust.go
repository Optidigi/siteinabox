package main

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
)

func main() {
	bundle, err := os.ReadFile(os.Getenv("SSL_CERT_FILE"))
	if err != nil {
		panic(err)
	}
	hash := sha256.Sum256(bundle)
	if hex.EncodeToString(hash[:]) != "5961c0a3c65459931c023e0075c09733f09aea4ca439cb85bc4a08bb4f3f568b" {
		panic("Unreviewed CA bundle")
	}
	count := 0
	remaining := bundle
	blocked := regexp.MustCompile(`(?i)^(emSign ECC Root CA - G3|Comodo AAA Services root|AAA Certificate Services)$`)
	for len(remaining) > 0 {
		block, rest := pem.Decode(remaining)
		if block == nil {
			break
		}
		remaining = rest
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil || blocked.MatchString(cert.Subject.CommonName) {
			panic("Invalid or compromised CA in trust bundle")
		}
		count++
	}
	pool, err := x509.SystemCertPool()
	if err != nil || count < 100 || len(pool.Subjects()) < 100 {
		panic("System CA trust missing")
	}
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") }))
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.StartTLS()
	defer server.Close()
	transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport}
	if response, err := client.Get(server.URL); err == nil {
		response.Body.Close()
		panic("Untrusted TLS certificate accepted")
	}
	trusted := pool.Clone()
	trusted.AddCert(server.Certificate())
	trustedTransport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: trusted, MinVersion: tls.VersionTLS12}}
	defer trustedTransport.CloseIdleConnections()
	response, err := (&http.Client{Transport: trustedTransport}).Get(server.URL)
	if err != nil {
		panic(err)
	}
	response.Body.Close()
	proof, err := json.Marshal(map[string]any{"bundleSha256": hex.EncodeToString(hash[:]), "rootCount": count, "compromisedRootsAbsent": true, "untrustedRejected": true, "trustedAccepted": true})
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile("/tmp/trust-proof.json", proof, 0644); err != nil {
		panic(err)
	}
}
