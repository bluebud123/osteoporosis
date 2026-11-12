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


## Railway, step by step (written 12 Nov 2026; NOT tried from the build environment)

Menu names on Railway may differ slightly from these. Deploy the branch **`demo`**, not the working branch: `demo` is frozen, so later work does not restart the site while a judge is using it.

### Before you start
1. In the DeepSeek dashboard: delete the old key, make a new one, and set a spending limit of a few dollars.
2. Choose two passwords for the judges (at least 8 characters). They go in the submission deck only, never in the repository.

### Create the service
1. railway.com: sign in with GitHub, choose the Hobby plan.
2. New Project, then "Deploy from GitHub repo", pick `bluebud123/osteoporosis`.
3. In the service's Settings: set the branch to `demo`. The start command is taken from `package.json` (`node app/server.js`); there is no build step. Pick the region closest to the judges that Railway offers.
4. Attach a volume to the service with the mount path `/data`.
5. In Settings, Networking: "Generate Domain". That https link is your deployment link.

### Variables (the service's Variables tab)

| Name | Value |
|---|---|
| `PERILOOP_DATA` | `/data` |
| `PERILOOP_DEMO` | `1` |
| `PERILOOP_TRUST_PROXY` | `1` |
| `PERILOOP_DOCTOR_PW` | the judges' doctor password |
| `PERILOOP_NURSE_PW` | the judges' nurse password |
| `PERILOOP_EMERGENCY_NUMBER` | the emergency number for where the judges are (confirm it first) |
| `PERILOOP_CLINIC_PHONE` | a clearly fictional number, for example `02-000 0000 (demo)` |
| `PERILOOP_CLINIC_HOURS` | for example `Mon to Fri, 8 am to 5 pm (demo)` |
| `PERILOOP_DEMO_RESET_MIN` | `30` |
| `AI_DAILY_MAX` | `3000` |
| `PROVIDER_BASE_URL` | `https://api.deepseek.com` |
| `PROVIDER_KEY` | the new DeepSeek key |
| `PROVIDER_MODEL` | `deepseek-chat` |

### Check it (10 minutes)
1. Open `https://<your link>/healthz`: it should show `{"ok":true}`.
2. Log in as `doctor` with the judges' password. `doctor-demo-1` must NOT work.
3. Settings, "Test AI connection": it must say the AI answered. If not, the host cannot reach DeepSeek or the key is wrong.
4. Live view: send "my calf is hard, sore and bigger than the other one" and "I cant breathe and my chest hurts". Both must alert.
5. Open a patient link on your phone.
6. Settings, "Reset the whole demo": it must reload 30 patients and keep you logged in.
7. Set up a free uptime monitor on the `/healthz` link so you get an email if the site goes down while you travel.

### What this demo mode does
- The two logins use the host's passwords at every start and after every reset. The passwords in the public README do not work.
- After 30 minutes with no activity, anything a visitor changed is put back to the starting state. The chief doctor can also do this from Settings. A reset while another judge is mid-demo would wipe their work too; the idle reset is the safer of the two.
- At most 3,000 AI calls a day. After that the site runs on rules only and says so, until the next day (UTC).
- One visitor trying many passwords is blocked without blocking everyone else.

### Still true
Anyone with the judges' passwords can read everything on the site, so it must hold fictional data only. Patient text typed into the demo is sent to DeepSeek. There are no backups.
