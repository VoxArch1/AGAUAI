AGAUAI Starter Pack — Clicks-Only Install (No Git Commands)

What this adds
1) /propose page that opens a prefilled GitHub Issue
2) Footer Site Map and lazy-loading for images/iframes
3) One-place form config + simple anti-spam (time-trap + honeypot)
4) Issue/PR templates for structure
5) Default share image (Open Graph)

Install via GitHub Web UI (no terminal)
1) Go to your repo on github.com
2) Click: Add file → Upload files
3) Drag-and-drop the whole contents of this zip into the repo
   (Folders: .github/ISSUE_TEMPLATE, assets/js, assets/img, config, and propose.html)
4) In the “Commit changes” box, type: "Add Starter Pack (propose page, forms config, site bootstrap)"
5) Choose: "Create a new branch" → name it: feat/starter-pack → Commit changes
6) GitHub will show a “Compare & pull request” banner → click it → Open Pull Request
7) Merge the PR when checks pass.

One manual edit to your homepage (index.html)
Add these lines inside <head>:
  <!-- AGAUAI: Starter Pack OG/Twitter cards -->
  <meta property="og:title" content="AGAUAI — A Collaboration for Peace">
  <meta property="og:description" content="People + AI building practical steps toward peace, live and in the open.">
  <meta property="og:image" content="assets/img/og-default.svg">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">

Add these before </body>:
  <!-- AGAUAI: Starter Pack scripts -->
  <script src="assets/js/forms-guard.js" defer></script>
  <script src="assets/js/site-init.js" defer></script>

Optional: Set the GitHub owner/repo for /propose.html
Edit propose.html and replace <OWNER>/<REPO> with your actual path (e.g., VoxArch1/www.agauai.com).
