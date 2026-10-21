#!/bin/bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips the build,
# exit 1 builds it. On the Hobby plan every deployment counts against 10 GB, so
# only build what changes the site.

# 1. The old duplicate project lightning-wolves-studio-jc1w is wired to this repo
#    too, but nothing uses it: never build it.
case "$VERCEL_URL" in
  lightning-wolves-studio-jc1w-*) echo "Skip: old duplicate project (jc1w)"; exit 0 ;;
esac

# 2. Commits that only touch notes or the database schema change nothing on the
#    site. Compare with the last deployed commit; if that isn't known or not in
#    the clone, git fails and we build (the safe side).
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if git diff --quiet "$BASE" HEAD -- . ':(exclude)*.md' ':(exclude)*.sql' 2>/dev/null; then
  echo "Skip: only notes or schema changed since $BASE"
  exit 0
fi

echo "Build"
exit 1
