Ollama integration (local)

Prerequisites
- Ollama installed and a model available locally
- Ollama server running: `ollama serve` (default port 11434)

Environment
- Optional: OLLAMA_URL (default http://localhost:11434)
- Optional: OLLAMA_ENABLED=true to enable structuring during module creation
- Optional: OLLAMA_MODEL (default 'llama2')

Endpoints
- POST /api/ollama
  { prompt: string, model?: string }
  Returns { success: true, output: string }

Usage
1. Start Ollama: `ollama serve`
2. Start backend: `npm start`
3. Test endpoint: `curl -X POST http://localhost:8080/api/ollama -H \"Content-Type: application/json\" -d \"{ \"prompt\": \"Hello\" }\"`

Integration with module creation
- Set OLLAMA_ENABLED=true in your environment to enable using Ollama to structure extracted text into JSON during module creation.
- If Ollama fails or returns non-JSON, the server falls back to the basic module structure.
