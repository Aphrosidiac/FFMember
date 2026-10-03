#!/usr/bin/env bash
# front_tab.sh <url-substring> — bring Google Chrome forward and activate the first tab whose
# URL contains the substring.
#
# Why: Chrome throttles occluded windows and inactive tabs. The claude-in-chrome MCP does not
# front them, so a tab behind the Claude window reports visibilityState "hidden", gets ~1 rAF
# per screenshot, and times out any script that awaits a frame (a 4 s preloader "took" over a
# minute on stanzza.design). resize_window also reports success while innerWidth stays stale.
# After this: 60 rAF/s and real timings. Confirm with
#   document.visibilityState === 'visible'
# before any motion judgement. Front each tab in turn to compare reference and ours.
# macOS only (AppleScript). Headless capture (capture.mjs) needs none of this.
set -euo pipefail
needle="${1:?usage: front_tab.sh <url-substring>}"
osascript - "$needle" <<'AS'
on run argv
  set needle to item 1 of argv
  tell application "Google Chrome"
    activate
    repeat with w in windows
      set i to 1
      repeat with t in tabs of w
        if (URL of t) contains needle then
          set active tab index of w to i
          set index of w to 1
          return "fronted " & (URL of t)
        end if
        set i to i + 1
      end repeat
    end repeat
  end tell
  return "no tab matching " & needle
end run
AS
