# Deploying PeriLoop for judges

Goal: a link that anyone can open in a browser, with no login. The whole app is one self-contained HTML file, so any static host works. Three free options are below.

## Before you deploy

- The published file must be named `index.html`. The repository currently has `prototype.html`. Rename it to `index.html` (the same file, just renamed).
- No credentials are needed, because there is no login. The link alone is enough.
- Check that the page contains no API key. Version 1 uses no model, so there should be none. Search the file for "key" or "api" before you publish.

## Option 1: GitHub Pages

1. Create a new public repository on GitHub (for example `periloop`).
2. Put the repository files in it, including `index.html` (renamed from `prototype.html`), `README.md` and `DEPLOY.md`. Commit to the branch `main`.
3. In the repository, go to **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**. Select branch **main** and folder **/ (root)**, then save.
5. Wait for the deployment to finish. The Pages section shows the link to the live site. Open it to check that the page loads and that Play 2-minute story works.

## Option 2: Netlify Drop

1. Make a folder that contains `index.html` (renamed from `prototype.html`). The folder can also hold `README.md`.
2. Open Netlify and use **Netlify Drop**.
3. Drag the folder onto the drop area. Netlify publishes it and gives you a link.
4. Open the link to check it. No account is needed to view the site.

## Option 3: Vercel

Either of these works:

- **Drag and drop**: in the Vercel dashboard, import or drop the folder containing `index.html`, then deploy. Open the link it gives you.
- **CLI**: install the Vercel CLI, go into the folder containing `index.html`, and run `vercel`. Accept the defaults. The command prints the link. Run `vercel --prod` if you want a production link.

## After deploying

- Open the link on a phone and on a laptop to check the layout.
- Run the 30-case tests tab once to confirm the page works on the host.
- Give judges the link. No login or credentials are needed.
