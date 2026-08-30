Ship this thread's completed changes to the live Mum Art application. The
user's Ship action authorizes the Git push to `origin/master` and the Vercel
production deployment described below for this thread only. It does not
authorize database writes, imports, or migrations.

1. Read `AGENTS.md` and inspect the repository state. Before changing Git,
   confirm that the current branch is `master` and that all uncommitted changes
   belong to this thread. If there are unexpected or unrelated changes, stop
   and ask the user rather than including, discarding, or overwriting them.
2. Before committing or pushing, confirm that `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   and `VERCEL_PROJECT_ID` are present without printing their values. Use the
   Vercel CLI installed by `.agents/setup` for read-only authentication and
   project checks. Prove that the token can access the configured existing
   project. Do not run `vercel link`, create a Vercel project, or change Vercel
   configuration. Stop and tell the user exactly which configuration is
   missing if the production target cannot be proved.
3. Commit this thread's uncommitted changes with a concise message. If the
   checkout is shallow, fetch the full history. Fetch `origin` and rebase onto
   `origin/master`. If a conflict could change behavior or cannot be resolved
   mechanically, stop and ask the user before continuing.
4. Inspect the final changes relative to `origin/master`. If they include a
   migration or require a production schema/data change, stop before pushing
   or deploying and request separate explicit approval for a coordinated
   database operation. Never apply a migration or run a mutating database
   command as part of Ship.
5. Run `npm --prefix web run check`. Fix failures caused by this thread. Do not
   weaken, skip, or suppress checks to make the command pass.
6. Push the checked commit to `origin/master`. If the push is rejected because
   `master` moved, fetch, rebase, run the complete check again, and retry. Ask
   before resolving any substantive conflict.
7. From the pushed commit, run `npm --prefix web run deploy:production`. The
   Vercel CLI reads its credentials from the environment; never put
   `VERCEL_TOKEN` in command arguments, files, or output. Capture the deployment
   URL and use read-only Vercel inspection to confirm the deployment reached a
   ready production state. Do not exercise any application action that writes
   inventory data.
8. Report the pushed commit SHA, the production deployment URL, and the
   verification result. If Git was pushed but deployment failed, state clearly
   that the repository changed while production did not, and stop rather than
   reverting, redeploying blindly, or making unrelated changes.
