# Upload and Host the Simulator on GitHub

This package includes the simulator source, a GitHub Pages deployment workflow, and a weekly BWF ranking-data refresh workflow. You do not need to build the site on your own computer.

## Before You Begin

- Sign in to [GitHub](https://github.com/).
- Extract the ZIP file before uploading it. Do not upload the ZIP itself to the repository.
- A public repository works with GitHub Pages on GitHub Free. A private repository requires a GitHub plan that supports Pages for private repositories.

## 1. Create an Empty Repository

1. On GitHub, select the **+** menu in the upper-right corner and choose **New repository**.
2. Enter a repository name, such as `badminton-ranking-points-simulator`.
3. Select **Public** unless your GitHub plan supports Pages for private repositories.
4. Do not select **Add a README file**, **Add .gitignore**, or **Choose a license**. The package already contains the required files.
5. Select **Create repository**.

Your eventual address will normally be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

## 2. Upload the Package

1. Extract `Badminton-World-Ranking-Points-Simulator-GitHub.zip` on your computer.
2. Open the extracted `Badminton-World-Ranking-Points-Simulator` folder.
3. Make hidden files visible so that `.github` and `.openai` are included:
   - macOS Finder: press **Command + Shift + .**
   - Windows File Explorer: open **View → Show → Hidden items**.
4. Return to the empty repository page on GitHub.
5. Select **uploading an existing file**. If the repository is no longer empty, use **Add file → Upload files**.
6. Drag the **contents inside** the extracted folder into the upload area. Do not drag only the enclosing folder.
7. Confirm that the upload includes at least `.github`, `.openai`, `app`, `components`, `lib`, `public`, `scripts`, `package.json`, and `pnpm-lock.yaml`.
8. In the commit-message field, enter `Initial simulator upload`.
9. Select **Commit changes**.

The package contains fewer than 100 files and no file exceeds GitHub's browser-upload limit.

## 3. Enable GitHub Pages

1. Open the repository's **Settings** tab.
2. In the left sidebar, select **Pages** under **Code and automation**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Leave the other Pages settings unchanged.

The included `.github/workflows/pages.yml` workflow builds and publishes the simulator. You do not need to choose a branch or a `/docs` folder.

## 4. Run the First Deployment

The initial upload normally starts **Deploy to GitHub Pages** automatically. To start it manually:

1. Open the repository's **Actions** tab.
2. In the left sidebar, select **Deploy to GitHub Pages**.
3. Select **Run workflow**.
4. Keep the branch set to **main**, then select the green **Run workflow** button.
5. Wait for both the **build** and **deploy** jobs to show green check marks.

GitHub can take several minutes to publish the first deployment. When it finishes, open **Settings → Pages** and select **Visit site**, or use the address shown in the completed workflow.

## 5. Confirm Weekly Ranking Updates

The included **Refresh BWF ranking data** workflow is scheduled every Tuesday at 09:30 GMT+1. It retrieves:

- the top 100 players or pairs in all five disciplines;
- every listed player's or pair's current ranking-points breakdown;
- the current year's remaining senior tournament calendar; and
- the previous year's full senior tournament calendar.

When refreshed data changes, the workflow commits it to `main`. The Pages workflow then republishes the simulator after the refresh completes.

To test the refresh manually:

1. Open **Actions**.
2. Select **Refresh BWF ranking data**.
3. Select **Run workflow** and confirm the `main` branch.
4. Wait for the workflow to finish. Processing 500 ranking entries and their breakdowns can take several minutes.

Scheduled GitHub Actions runs may begin slightly later than the target time. GitHub may also disable scheduled workflows in a public repository after 60 days without repository activity. If that happens, open **Actions → Refresh BWF ranking data**, use the workflow menu to enable it, and run it once manually.

## Updating the Simulator Later

To upload a newer package, open **Add file → Upload files**, drag in the updated files, and commit the changes to `main`. The Pages workflow will rebuild the site automatically.

## Troubleshooting

### The Site Shows a 404 Page

- Confirm **Settings → Pages → Source** is set to **GitHub Actions**.
- Open **Actions → Deploy to GitHub Pages** and check whether both jobs succeeded.
- Use the exact URL shown by GitHub; project sites include the repository name at the end.

### The Build Failed

- Open the failed workflow and expand the red step to read its message.
- Confirm that `.github`, `.openai`, `package.json`, `pnpm-lock.yaml`, `app`, `components`, `lib`, and `public` were uploaded.
- Confirm the default branch is named `main`.

### Weekly Rankings Did Not Refresh

- Open **Actions → Refresh BWF ranking data** and confirm the workflow is enabled.
- Run it manually to distinguish a scheduling delay from a scraper error.
- If the BWF website changes its page structure, the scraper may require an update before it can read the new layout.
