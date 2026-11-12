# Hosting the PeriLoop Console for judges

The Console in `app/` is a small Node server (Node 18 or newer, no packages to install). It is not a static page, so GitHub Pages will not run it. The older single-page prototype at the repository root (`index.html`) is a static page and can still be served by GitHub Pages, but it is not the product described in the brief.

These steps are generic and have not been tried on a particular host from the build environment.

## What the server needs

| Setting | Meaning |
|---|---|
| Start command | `node app/server.js` |
| `PORT` | The port to listen on (default 8080). Most hosts set this for you |
| `PERILOOP_DATA` | A folder the server can write to. All data is one file, `db.json`, in it. If the host wipes its disk on restart, the demo simply reloads its 30 fictional patients |
| `PROVIDER_BASE_URL`, `PROVIDER_KEY`, `PROVIDER_MODEL` | Optional. Turns on the AI second check and chat replies. Without them the Console runs on rules only and says so on the Today screen |

## Steps

1. Pick any host that runs a Node web service from a GitHub repository, or a small virtual machine.
2. Point it at this repository and branch. Set the start command to `node app/server.js`. There is no build step.
3. Make sure the site is served over HTTPS. The login cookie and the patient links should not travel over plain HTTP.
4. Open the link, log in as `doctor` / `doctor-demo-1`, and in Settings set the emergency number for where the judges are.
5. If the link will be public, change both demo passwords in Settings and give the judges the new ones privately. Leave the "Demo system" banner on.
6. Check: Today loads, the Live view opens, a patient link opens on a phone, and a typed message appears in all three columns of the Live view.
7. Put the link and the logins in `docs/solution-brief.md` section 8.

## Do not

- Do not enter any real patient information. The server stores data unencrypted in one file and has no backups.
- Do not commit an API key. Set it as an environment variable on the host.
- Do not leave a public demo running with an AI key and no spending limit.
