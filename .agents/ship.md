Ship this thread's completed changes to the live Mum Art application. The
user's Ship action authorizes the Git push to `origin/master`. Vercel tracks
`master`, so that push automatically starts a production deployment for this
thread's commit. Ship does not authorize database writes, imports, or
migrations.

1. Read `AGENTS.md` and inspect the repository state. Before changing Git,
   confirm that the current branch is `master` and that all uncommitted changes
   belong to this thread. If there are unexpected or unrelated changes, stop
   and ask the user rather than including, discarding, or overwriting them.
2. Commit this thread's uncommitted changes with a concise message. If the
   checkout is shallow, fetch the full history. Fetch `origin` and rebase onto
   `origin/master`. If a conflict could change behavior or cannot be resolved
   mechanically, stop and ask the user before continuing.
3. Inspect the final changes relative to `origin/master`. If they include a
   migration or require a production schema/data change, stop before pushing
   or deploying and request separate explicit approval for a coordinated
   database operation. Never apply a migration or run a mutating database
   command as part of Ship.
4. Run `npm --prefix web run check`. Fix failures caused by this thread. Do not
   weaken, skip, or suppress checks to make the command pass.
5. Push the checked commit to `origin/master`. This push is the production
   release action. If the push is rejected because `master` moved, fetch,
   rebase, run the complete check again, and retry. Ask before resolving any
   substantive conflict.
6. Wait for the Vercel GitHub deployment or commit status attached to the exact
   pushed commit. Confirm that it reaches a successful production state and
   capture its target URL. Do not treat a successful push by itself as a
   successful deployment, and do not exercise any application action that
   writes inventory data.
7. Report the pushed commit SHA, the production deployment URL, and the
   verification result. If Git was pushed but the deployment failed or its
   status cannot be confirmed, state clearly that the repository changed while
   production is failed or unverified, and stop rather than reverting,
   redeploying blindly, or making unrelated changes.
