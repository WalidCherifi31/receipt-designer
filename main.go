// Receipt Designer: a local tool for designing an 80mm thermal receipt
// template, previewing it live, and exporting an implementation spec.
//
// It serves an embedded web UI on 127.0.0.1 and opens it in the default
// browser. Designs are autosaved to receipt-design.json next to the .exe,
// and exports are written to the exports/ folder next to the .exe.
package main

import (
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed web
var webFS embed.FS

var baseDir string

func main() {
	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	baseDir = filepath.Dir(exe)
	// When run with `go run`, the executable lives in a temp dir; use cwd instead.
	if strings.Contains(baseDir, "go-build") {
		baseDir, _ = os.Getwd()
	}

	sub, _ := fs.Sub(webFS, "web")
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(sub)))
	mux.HandleFunc("/api/design", handleDesign)
	mux.HandleFunc("/api/export", handleExport)
	mux.HandleFunc("/api/open-exports", handleOpenExports)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	url := fmt.Sprintf("http://%s/", ln.Addr().String())

	fmt.Println("==============================================")
	fmt.Println("  Receipt Designer")
	fmt.Println("==============================================")
	fmt.Println("  Open in your browser:", url)
	fmt.Println("  Design file:", filepath.Join(baseDir, "receipt-design.json"))
	fmt.Println("  Exports folder:", filepath.Join(baseDir, "exports"))
	fmt.Println()
	fmt.Println("  Close this window to quit.")
	fmt.Println("==============================================")

	go func() {
		time.Sleep(300 * time.Millisecond)
		openPath(url)
	}()
	log.Fatal(http.Serve(ln, mux))
}

func designPath() string { return filepath.Join(baseDir, "receipt-design.json") }

// GET returns the saved design (or 204 if none); PUT saves it.
func handleDesign(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		b, err := os.ReadFile(designPath())
		if err != nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	case http.MethodPut:
		b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
		if err != nil || !json.Valid(b) {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if err := os.WriteFile(designPath(), b, 0o644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

type exportReq struct {
	Spec    string          `json:"spec"`
	Design  json.RawMessage `json:"design"`
	LogoPNG string          `json:"logo"` // data URL, optional
}

// POST writes spec + design + logo into exports/<timestamp>/.
func handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req exportReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 40<<20)).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	dir := filepath.Join(baseDir, "exports", time.Now().Format("2006-01-02_15-04-05"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	files := map[string][]byte{
		"receipt-spec.md":     []byte(req.Spec),
		"receipt-design.json": req.Design,
	}
	if req.LogoPNG != "" {
		if i := strings.Index(req.LogoPNG, ","); i >= 0 {
			ext := "png"
			if strings.Contains(req.LogoPNG[:i], "svg") {
				ext = "svg"
			} else if strings.Contains(req.LogoPNG[:i], "jpeg") {
				ext = "jpg"
			}
			if data, err := base64.StdEncoding.DecodeString(req.LogoPNG[i+1:]); err == nil {
				files["logo."+ext] = data
			}
		}
	}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"dir": dir})
}

func handleOpenExports(w http.ResponseWriter, r *http.Request) {
	dir := filepath.Join(baseDir, "exports")
	os.MkdirAll(dir, 0o755)
	openPath(dir)
	w.WriteHeader(http.StatusNoContent)
}

func openPath(p string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		if strings.HasPrefix(p, "http") {
			cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", p)
		} else {
			cmd = exec.Command("explorer", p)
		}
	case "darwin":
		cmd = exec.Command("open", p)
	default:
		cmd = exec.Command("xdg-open", p)
	}
	_ = cmd.Start()
}
