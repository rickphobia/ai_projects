# 36: Effects with punch

**What to build:** Each tower fires its own projectile (a bullet from the Sniper Nest, a light beam from the Lighthouse, sound rings from the Siren), shots land with a small star puff, a Wall-breaker hitting a wall makes a "bonk" burst, and "+Xg" coins pop up where gold is earned (also when Take back refunds gold). Ordinary effects last about a fifth of a second. The Goal breaking collapses the office into rubble with a screen shake, and a boss arriving or dying shakes the screen; nothing else shakes. See `docs/specs/art-pass.md`, stories 24–31.

**Blocked by:** 34 (Draw the Pieces in code)

**Status:** done

**Touches:** renderer/effects, renderer/units, renderer/camera, renderer/art-kit, run-screen

**Effort:** medium

- [x] Each tower kind has its own projectile; hits puff; wall hits bonk
- [x] Gold pops show for earned gold and for Take back refunds
- [x] Effects reuse pooled sprites; ordinary effects last about 0.2 s
- [x] Screen shake only for the Goal breaking and bosses, decaying in under half a second
- [x] The spec's "Look" effects rule is rewritten
- [x] The debug swarm screen (500 Interns) still runs at 60 fps on the Beelink's browser; the fps is in the PR
- [x] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
