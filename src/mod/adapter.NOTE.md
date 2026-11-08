# Swapping the model provider (adapter.js + server/chat.js + second_check.js)
1. Browser side: pass `createAdapter({ mode: 'ai', proxyUrl: '<your chat endpoint>' })`. No key goes in the browser.
2. Server side: set env `PROVIDER_BASE_URL`, `PROVIDER_KEY`, `PROVIDER_MODEL` (DeepSeek: `https://api.deepseek.com`, `deepseek-chat`).
3. To switch provider, change only those three env values (or `presets.local` / `presets.deepseek` in adapter.js for direct use).
4. Any OpenAI-style `/v1/chat/completions` server works (local Qwen3-8B on port 8000, or another vendor). Set `PROVIDER_ENDPOINT` if its path differs.
5. Run `node mod/server/chat.js` locally (PORT, default 8787), then deploy the handler to Vercel, Netlify or Cloudflare.
6. Edge/ESM hosts need `export default` syntax. The file is CommonJS, so wrap or copy `handle` into an ESM file first. chat.js now requires `../adapter.js` AND `../second_check.js`, so the deployed bundle must include both.
7. Set `ALLOWED_ORIGINS` for any origin other than `*.github.io`.
8. Rate limits are in-memory per IP and per instance, so they reset on each instance. Intake: 20/min. Second check: 60/min, a separate bucket. Add a shared store for production.
9. Do not add a new provider's key to browser code. Always route through the proxy.
10. Run `node mod/adapter.test.js` after any change. Expect 18 PASS, 0 FAIL.

## Second check (server-owned prompt)
- The page sends `{mode:'second_check', text:'<patient message>'}` to the same proxyUrl. It never sends a system prompt. The proxy ignores any `messages` or `system` field in this mode.
- The system prompt is `SYSTEM_PROMPT` in `mod/second_check.js`. The proxy imports that one constant, so there is one source of truth. Edit it there and redeploy the proxy.
- The proxy wraps the text in `<msg></msg>`, sends `temperature: 0`, `max_tokens: 80`, JSON mode, and times out upstream at 7 s. The page times out at 8 s, so the proxy answers first.
- Identifiers (IC, phone, email) are redacted to `[id]`, `[phone]`, `[email]` before upstream. They are not refused, so an urgent message is still screened.
- The reply is `{"text":"{\"verdict\":\"urgent|routine\",\"reason\":\"...\"}"}`, validated strictly. Anything else, or any upstream failure, returns `{"verdict":"unscreened","reason":"second check unavailable"}`.
- Deploy checklist: (a) `node mod/proxy_e2e.test.js` passes, (b) set the three `PROVIDER_*` env values on the host, (c) deploy chat.js with adapter.js and second_check.js, (d) `curl -X POST <url> -d '{"mode":"second_check","text":"my chest hurts"}'` returns `verdict: urgent` (or unscreened if the provider is down), (e) set `ALLOWED_ORIGINS` if the page is not on github.io.

## Tests (run all after any change)
- `node test.js`: 30/30 cases pass.
- `node build.js`: rebuilds index.html.
- `node mod/adapter.test.js`: 18 PASS, 0 FAIL.
- `node mod/second_check.test.js`: 26 PASS, 0 FAIL.
- `node mod/chat_ratelimit.test.js`: 5 PASS, 0 FAIL (rate limiter unit tests).
- `node mod/proxy_e2e.test.js`: 19 PASS, 0 FAIL (real chat.js on a free port, stub upstream, real adapter and second_check; about 8 s because of the slow-upstream case).
- All other `mod/*.test.js` files also pass with exit code 0.
