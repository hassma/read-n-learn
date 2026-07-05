interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  sourceLang: string;
  targetLang: string;
}

const MODEL_SUGGESTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "llama-3-70b-8192",
  "mistral-medium",
  "deepseek-chat",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.1-70b-instruct",
];

const BASE_URL_SUGGESTIONS = [
  "https://api.openai.com/v1",
  "https://api.groq.com/openai/v1",
  "https://api.together.xyz/v1",
  "https://openrouter.ai/api/v1",
  "http://localhost:11434/v1",
  "http://localhost:1234/v1",
];

function buildPage(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div class="page">
      <header class="page-header">
        <h1><span class="logo-text">LinguaSide</span> Settings</h1>
      </header>

      <section class="settings-section" aria-labelledby="api-title">
        <h2 class="section-title" id="api-title">API Configuration</h2>
        <div class="field">
          <label for="baseUrl">API Base URL</label>
          <input id="baseUrl" type="url" list="base-url-list" placeholder="https://api.openai.com/v1" autocomplete="off" />
          <datalist id="base-url-list">
            ${BASE_URL_SUGGESTIONS.map((u) => `<option value="${u}">`).join("")}
          </datalist>
          <span class="field-hint">OpenAI, Groq, Together AI, OpenRouter, Ollama, LM Studio…</span>
        </div>
        <div class="field">
          <label for="apiKey">API Key</label>
          <input id="apiKey" type="password" placeholder="sk-…" autocomplete="off" />
        </div>
        <div class="field">
          <label for="model">Model</label>
          <input id="model" type="text" list="model-list" placeholder="gpt-4o-mini" autocomplete="off" />
          <datalist id="model-list">
            ${MODEL_SUGGESTIONS.map((m) => `<option value="${m}">`).join("")}
          </datalist>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="lang-title">
        <h2 class="section-title" id="lang-title">Language Pair</h2>
        <div class="field">
          <label for="sourceLang">Source language (article)</label>
          <input id="sourceLang" type="text" placeholder="auto-detect" />
          <span class="field-hint">e.g. French, Spanish, Japanese — or leave blank to auto-detect</span>
        </div>
        <div class="field">
          <label for="targetLang">Your native language</label>
          <input id="targetLang" type="text" placeholder="English" />
        </div>
      </section>

      <div class="actions">
        <button id="save-btn" class="btn-primary" type="button">Save Settings</button>
        <button id="test-btn" class="btn-secondary" type="button">Test Connection</button>
        <span id="connection-result" class="connection-result" aria-live="polite"></span>
        <div id="save-toast" class="toast success" role="status" aria-live="polite">
          ✓ Settings saved
        </div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const baseUrlInput  = $<HTMLInputElement>("baseUrl");
  const apiKeyInput   = $<HTMLInputElement>("apiKey");
  const modelInput    = $<HTMLInputElement>("model");
  const sourceLangInput = $<HTMLInputElement>("sourceLang");
  const targetLangInput = $<HTMLInputElement>("targetLang");
  const saveBtn       = $<HTMLButtonElement>("save-btn");
  const testBtn       = $<HTMLButtonElement>("test-btn");
  const connectionResult = $("connection-result");
  const saveToast     = $("save-toast");

  // Load stored settings
  browser.storage.local.get(["apiKey", "baseUrl", "model", "sourceLang", "targetLang"])
    .then((stored) => {
      baseUrlInput.value   = (stored.baseUrl    as string) || "";
      apiKeyInput.value    = (stored.apiKey     as string) ? "••••••••" : "";
      modelInput.value     = (stored.model      as string) || "";
      sourceLangInput.value = (stored.sourceLang as string) || "";
      targetLangInput.value = (stored.targetLang as string) || "";

      // Clear the mask when user focuses the key field
      apiKeyInput.addEventListener("focus", () => {
        if (apiKeyInput.value === "••••••••") apiKeyInput.value = "";
      });
    });

  saveBtn.addEventListener("click", async () => {
    const toSave: Partial<ApiSettings> = {
      baseUrl:    baseUrlInput.value.trim()    || "https://api.openai.com/v1",
      model:      modelInput.value.trim()      || "gpt-4o-mini",
      sourceLang: sourceLangInput.value.trim() || "auto",
      targetLang: targetLangInput.value.trim() || "English",
    };
    // Only overwrite apiKey if user actually typed something new
    const key = apiKeyInput.value.trim();
    if (key && key !== "••••••••") toSave.apiKey = key;

    await browser.storage.local.set(toSave);

    // Show toast briefly
    saveToast.classList.add("show");
    setTimeout(() => saveToast.classList.remove("show"), 2500);
  });

  testBtn.addEventListener("click", async () => {
    connectionResult.className = "connection-result show";
    connectionResult.textContent = "Testing…";

    try {
      const stored = await browser.storage.local.get(["apiKey", "baseUrl", "model"]);
      const apiKey  = (stored.apiKey  as string) || "";
      const baseUrl = (stored.baseUrl as string) || "https://api.openai.com/v1";
      const model   = (stored.model   as string) || "gpt-4o-mini";

      if (!apiKey) throw new Error("No API key saved yet. Save settings first.");

      const providerHeaders: Record<string, string> = baseUrl.includes("openrouter.ai")
        ? { "HTTP-Referer": "https://github.com/hassma/read-n-learn", "X-Title": "LinguaSide" }
        : {};

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...providerHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 16,
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 80)}`);
      }

      connectionResult.className = "connection-result show ok";
      connectionResult.textContent = "✓ Connected";
    } catch (err) {
      connectionResult.className = "connection-result show fail";
      connectionResult.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    }
  });
}

buildPage();
