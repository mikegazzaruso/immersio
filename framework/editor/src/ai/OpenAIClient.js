/**
 * OpenAIClient — calls OpenAI-compatible Chat Completions API.
 *
 * Designed for future Ollama compatibility: same API format, different base URL.
 * Ollama: set baseURL to 'http://localhost:11434/v1'
 */

const DEFAULT_BASE_URL = '/api/openai'; // proxied by Vite to https://api.openai.com
const DEFAULT_MODEL = 'gpt-4o';
const STORAGE_KEY_API_KEY = 'immersio-editor-ai-key';      // must match SettingsPanel
const STORAGE_KEY_MODEL = 'immersio-editor-ai-model';      // must match SettingsPanel
const STORAGE_KEY_BASE_URL = 'immersio_openai_base_url';
const STORAGE_KEY_PROVIDER = 'immersio_ai_provider';

export class OpenAIClient {
  constructor(opts = {}) {
    this._provider = opts.provider || localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openai';
    this._apiKey = opts.apiKey || localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    this._model = opts.model || localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL;
    this._baseURL = opts.baseURL || localStorage.getItem(STORAGE_KEY_BASE_URL) || DEFAULT_BASE_URL;
    this._lastUsage = null;
  }

  // ---- Configuration ----

  get provider() { return this._provider; }
  set provider(p) {
    this._provider = p;
    localStorage.setItem(STORAGE_KEY_PROVIDER, p);
  }

  get apiKey() { return this._apiKey; }
  set apiKey(key) {
    this._apiKey = key;
    localStorage.setItem(STORAGE_KEY_API_KEY, key);
  }

  get model() { return this._model; }
  set model(m) {
    this._model = m;
    localStorage.setItem(STORAGE_KEY_MODEL, m);
  }

  get baseURL() { return this._baseURL; }
  set baseURL(url) {
    this._baseURL = url;
    localStorage.setItem(STORAGE_KEY_BASE_URL, url);
  }

  get isConfigured() {
    if (this._provider === 'ollama') return true;
    return this._apiKey.length > 0;
  }

  get lastUsage() { return this._lastUsage; }

  // ---- Chat Completions ----

  /**
   * Send a chat completion request.
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} opts — { temperature, maxTokens }
   * @returns {Promise<{content: string, usage: object}>}
   */
  async complete(messages, opts = {}) {
    if (!this.isConfigured) {
      throw new OpenAIError('AI not configured. Open Settings to set up OpenAI or Ollama.', 'auth');
    }

    // Ollama uses its native /api/chat endpoint (supports think:false properly).
    // OpenAI uses the standard /v1/chat/completions endpoint.
    if (this._provider === 'ollama') {
      return this._completeOllama(messages, opts);
    }
    return this._completeOpenAI(messages, opts);
  }

  /** OpenAI Chat Completions API */
  async _completeOpenAI(messages, opts) {
    console.log(`[OpenAI] model=${this._model}, messages=${messages.length}`);
    const body = {
      model: this._model,
      messages,
      temperature: opts.temperature ?? 0.3,
    };
    if (opts.maxTokens) {
      // Newer models (gpt-5.x, o-series) require max_completion_tokens
      const useNew = /^(gpt-5|o[1-9])/.test(this._model);
      body[useNew ? 'max_completion_tokens' : 'max_tokens'] = opts.maxTokens;
    }

    const url = `${this._baseURL}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (this._apiKey) {
      headers['Authorization'] = `Bearer ${this._apiKey}`;
    }

    const response = await this._fetch(url, headers, body);
    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new OpenAIError('No response from model', 'api');
    }

    // Detect truncated response
    if (choice.finish_reason === 'length') {
      const err = new OpenAIError('Model response was cut off (token limit reached).', 'api');
      err.rawResponse = choice.message?.content?.slice(0, 500) || '';
      throw err;
    }

    this._lastUsage = data.usage || null;
    const content = choice.message?.content || '';
    if (!content.trim()) {
      throw new OpenAIError('Model returned an empty response.', 'api');
    }

    return { content, usage: data.usage || null };
  }

  /** Ollama native /api/chat — supports think:false for reasoning models */
  async _completeOllama(messages, opts) {
    console.log(`[Ollama] model=${this._model}, messages=${messages.length}`);
    const body = {
      model: this._model,
      messages,
      stream: false,
      think: false, // Disable Qwen3/thinking model reasoning mode
      options: {
        temperature: opts.temperature ?? 0.3,
        num_predict: opts.maxTokens || 8192,
      },
    };

    // Use Ollama native endpoint: /api/ollama/api/chat → proxied to localhost:11434/api/chat
    const url = `${this._baseURL}/api/chat`;
    const headers = { 'Content-Type': 'application/json' };

    const response = await this._fetch(url, headers, body);
    const data = await response.json();

    if (!data.message) {
      throw new OpenAIError('No response from Ollama model', 'api');
    }

    // Check if response was truncated
    if (data.done_reason === 'length' || (!data.done && !data.message.content)) {
      const err = new OpenAIError('Model response was cut off (token limit). Try a simpler prompt.', 'api');
      err.rawResponse = data.message.content?.slice(0, 500) || '';
      throw err;
    }

    const content = data.message.content || '';
    if (!content.trim()) {
      throw new OpenAIError('Model returned an empty response. Try a different model or simpler prompt.', 'api');
    }

    // Build usage object from Ollama's native fields
    const usage = {
      prompt_tokens: data.prompt_eval_count || 0,
      completion_tokens: data.eval_count || 0,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    };
    this._lastUsage = usage;

    return { content, usage };
  }

  /** Shared fetch with error handling */
  async _fetch(url, headers, body) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new OpenAIError(`Network error: ${err.message}`, 'network');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new OpenAIError('Invalid API key', 'auth');
      }
      if (response.status === 429) {
        throw new OpenAIError('Rate limited — try again shortly', 'rate_limit');
      }
      throw new OpenAIError(
        `API error ${response.status}: ${errorBody.slice(0, 200)}`,
        'api'
      );
    }

    return response;
  }

  /**
   * Send a chat completion and parse the response as JSON.
   * Strips markdown code fences if present.
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} opts
   * @returns {Promise<{json: object, usage: object}>}
   */
  async completeJSON(messages, opts = {}) {
    const result = await this.complete(messages, opts);
    let text = result.content.trim();

    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    // Strip leading text before first { or [
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let jsonStart = -1;
    if (firstBrace >= 0 && firstBracket >= 0) {
      jsonStart = Math.min(firstBrace, firstBracket);
    } else if (firstBrace >= 0) {
      jsonStart = firstBrace;
    } else if (firstBracket >= 0) {
      jsonStart = firstBracket;
    }
    if (jsonStart > 0) {
      text = text.slice(jsonStart);
    }

    // Strip trailing text after last } or ]
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const jsonEnd = Math.max(lastBrace, lastBracket);
    if (jsonEnd >= 0 && jsonEnd < text.length - 1) {
      text = text.slice(0, jsonEnd + 1);
    }

    // Replace Math.PI expressions with numeric values (LLMs often output these)
    text = text
      .replace(/Math\.PI\s*\*\s*2/g, String(Math.PI * 2))
      .replace(/Math\.PI\s*\/\s*6/g, String(Math.PI / 6))
      .replace(/Math\.PI\s*\/\s*4/g, String(Math.PI / 4))
      .replace(/Math\.PI\s*\/\s*3/g, String(Math.PI / 3))
      .replace(/Math\.PI\s*\/\s*2/g, String(Math.PI / 2))
      .replace(/-\s*Math\.PI/g, String(-Math.PI))
      .replace(/Math\.PI/g, String(Math.PI));

    let json;
    try {
      json = JSON.parse(text);
    } catch (firstErr) {
      // Attempt to repair common LLM JSON mistakes
      const repaired = this._repairJSON(text);
      try {
        json = JSON.parse(repaired);
      } catch (err) {
        const parseErr = new OpenAIError(
          `Failed to parse LLM response as JSON: ${firstErr.message}`,
          'parse'
        );
        parseErr.rawResponse = result.content;
        throw parseErr;
      }
    }

    return { json, usage: result.usage };
  }

  /** Fix common LLM JSON mistakes */
  _repairJSON(text) {
    let s = text;
    // Fix mismatched brackets: ] where } expected and vice versa
    // Walk through and track expected closers
    const stack = [];
    const chars = s.split('');
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        const expected = stack.pop();
        if (expected && c !== expected) {
          chars[i] = expected; // swap wrong closer
        }
      }
    }
    s = chars.join('');
    // Close unclosed brackets/braces
    while (stack.length > 0) {
      s += stack.pop();
    }
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
  }
}

export class OpenAIError extends Error {
  /**
   * @param {string} message
   * @param {'auth'|'network'|'rate_limit'|'api'|'parse'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'OpenAIError';
    this.code = code;
  }
}
