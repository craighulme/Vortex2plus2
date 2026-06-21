# Vortex2+2 Commands

This file documents the current Vortex2+2 chat commands and browser console helpers.

For a license key or more command authorisation, contact `quackduck.` on Discord.

## Access Levels

| Access | Meaning |
| --- | --- |
| Base license | Requires a valid Vortex2+2 license with `vortex-native-bridge`. |
| `teleport-commands` | Allows local teleport chat commands. The hosted relay also rejects obvious movement jumps unless this feature is on the lease. |
| `bring-command` | Allows the local-only bring command. This moves the remote model in your browser view only. |
| `fly-command` | Allows browser-side fly mode. Space rises, Shift/Ctrl descends. |
| `noclip-command` | Allows browser-side noclip mode, bypassing local map collision. |
| `gravity-command` | Allows browser-side gravity/fall-speed scaling. |
| `airwalk-command` | Allows browser-side airwalk mode, which keeps the player from being pulled down by gravity. |
| `avatar-spoof` | Allows avatar override/spoof commands. The hosted relay enforces this for join/avatar data it receives. |
| `packet-debug` | Allows packet/debug inspection helpers. These are intended for authorised testing, not normal users. |
| Local/dev only | Intended for private development or local relay testing. |

## Chat Commands

Chat commands are typed in Vortex chat and start with `::`.

| Command | Aliases | Access | What it does |
| --- | --- | --- | --- |
| `::help` | `::?` | Base license | Prints the current chat command list. |
| `::players` | `::plr` | Base license | Lists remote players currently loaded by the browser multiplayer bridge. |
| `::where [player]` | `::pos`, `::coords` | Base license | Without a player, prints your local position. With a player name/id, prints that remote player's last known position. |
| `::tp <x> <y> <z>` | `::teleport` | `teleport-commands` | Moves your local browser character to the supplied coordinates. |
| `::goto <player>` | `::to` | `teleport-commands` | Moves your local browser character to the named/id-matched remote player's last known position. |
| `::bring <player>` | none | `bring-command` | Moves the selected remote model near you locally. This does not move that player server-side. |
| `::fly [on\|off\|speed]` | none | `fly-command` | Toggles fly mode. Use Space to rise and Shift/Ctrl to descend. A number sets fly speed. |
| `::noclip [on\|off]` | `::clip` | `noclip-command` | Toggles local collision bypass. `::clip` is the inverse helper for turning collision back on. |
| `::airwalk [on\|off]` | `::air` | `airwalk-command` | Toggles walking in mid-air without gravity pulling you down. |
| `::setgravity <0..8\|reset>` | `::gravity`, `::fallspeed` | `gravity-command` | Changes gravity/fall speed scale. `1` is normal, `0.5` is slower, `2` is faster, `0` removes gravity. |
| `::movement` | `::moves`, `::mods` | Base license | Prints current fly/noclip/airwalk/gravity state. |

## Console Commands

Run these from the browser devtools console while in a Vortex game page with Vortex2+2 loaded.

### `window.VortexPacketDebug`

| Command | Access | Notes |
| --- | --- | --- |
| `VortexPacketDebug.enable(true)` | `packet-debug` | Enables packet debug console output and stores the setting in `localStorage`. |
| `VortexPacketDebug.enable(false)` | `packet-debug` | Disables packet debug console output. |
| `VortexPacketDebug.table()` | `packet-debug` | Prints the current known replicated players as a table. |
| `VortexPacketDebug.players()` | `packet-debug` | Returns the current known replicated player snapshots. |
| `VortexPacketDebug.last(id)` | `packet-debug` | Returns the last debug snapshot for one player id. |
| `VortexPacketDebug.history()` | `packet-debug` | Returns recent replicated player batches. |
| `VortexPacketDebug.setJoinAvatar(patch)` | `avatar-spoof` | Saves an avatar override used when joining future sessions. |
| `VortexPacketDebug.getJoinAvatar()` | Base license | Returns the saved join avatar override, if any. |
| `VortexPacketDebug.clearJoinAvatar()` | Base license | Clears the saved join avatar override. |
| `VortexPacketDebug.setJoinOutfit(patch)` | `avatar-spoof` | Alias for `setJoinAvatar`. |
| `VortexPacketDebug.spoofAvatar(patch)` | `avatar-spoof` | Applies and sends an avatar spoof using the current movement format. |
| `VortexPacketDebug.spoofAvatarCompact(patch, options)` | `avatar-spoof` | Applies and sends an avatar spoof using compact movement encoding. |
| `VortexPacketDebug.spoofAvatarResync(patch, options)` | `avatar-spoof` | Sends a spoof, waits, then resyncs the movement format. |
| `VortexPacketDebug.spoofAvatarDropResync(patch, options)` | `avatar-spoof` | Sends a compact spoof and later resyncs. |
| `VortexPacketDebug.spoofAvatarReset(patch, options)` | `avatar-spoof` | Local relay/reset-style avatar sync helper. |
| `VortexPacketDebug.spoofAvatarRejoin(...)` | Disabled | Currently throws because reopening UDP is treated as another native window. |
| `VortexPacketDebug.setMovementFormat(format)` | Local/dev only | Sets relay movement format: `native-auto`, `native-full`, `native-lite`, or `compact`. |
| `VortexPacketDebug.spoofShirt(id)` | `avatar-spoof` | Spoofs only the shirt id. |
| `VortexPacketDebug.spoofOutfit(shirtId, pantId, faceId)` | `avatar-spoof` | Spoofs shirt, pants, and face ids. |
| `VortexPacketDebug.spoofColors(colors)` | `avatar-spoof` | Spoofs body colours. |
| `VortexPacketDebug.randomSpoof(options)` | `avatar-spoof`, dev testing | Starts repeated/random avatar spoof traffic. Treat as private testing only. |
| `VortexPacketDebug.stopRandomSpoof()` | Base license | Stops active random spoof timers. |
| `VortexPacketDebug.latencies()` | Dev testing | Prints spoof latency measurements. |
| `VortexPacketDebug.probe(options)` | Local/dev only | Sends a probe packet through the relay. Requires a local/relay connection. |
| `VortexPacketDebug.probeCases()` | Base license | Lists supported probe case names. |
| `VortexPacketDebug.probes()` | Dev testing | Prints recorded probe events. |
| `VortexPacketDebug.clearSpoof()` | `avatar-spoof` if original exists | Restores the saved original avatar when available. |

Example avatar patch:

```js
VortexPacketDebug.spoofOutfit(12, 8, 3)
VortexPacketDebug.setJoinAvatar({
  shirt_id: 12,
  pant_id: 8,
  body_type: "male",
  body_colors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
  face_id: 3
})
```

### `window.VortexAvatar`

These helpers interact with the local browser avatar renderer and/or the logged-in Vortex account.

| Command | Access | Notes |
| --- | --- | --- |
| `VortexAvatar.renderer` | Base license | Reads the current avatar renderer mode. |
| `VortexAvatar.setRenderer(mode)` | Base license | Changes renderer mode through the local Vortex2+2 avatar renderer. |
| `VortexAvatar.getOutfit()` | Base license | Returns the current local outfit data. |
| `await VortexAvatar.setOutfit(outfit, persist)` | Logged-in Vortex account | Applies an outfit locally; if `persist` is true, sends it to `/api/clothing/outfit`. |

### `window.VortexMovement`

These helpers mirror the movement chat commands from devtools.

| Command | Access | Notes |
| --- | --- | --- |
| `VortexMovement.get()` | Base license | Returns current movement modifier state. |
| `VortexMovement.status()` | Base license | Returns a readable movement state string. |
| `VortexMovement.fly(value, speed)` | `fly-command` | Toggles fly mode. `VortexMovement.fly(40)` enables fly at speed 40. |
| `VortexMovement.noclip(value)` | `noclip-command` | Toggles collision bypass. |
| `VortexMovement.airwalk(value)` | `airwalk-command` | Toggles airwalk/no-fall mode. |
| `VortexMovement.setGravity(scale)` | `gravity-command` | Sets gravity scale from `0` to `8`, or pass `"reset"`. |
| `VortexMovement.reset()` | Base license | Disables fly/noclip/airwalk and restores normal gravity/speed. |

### Browser Internals / Local Debug Helpers

These exist for debugging or engine integration and are not public user commands. Most of these are local browser helpers, so the Rust relay does not "deny" them because they never reach the relay. Server-side enforcement only applies to relay-visible behaviour such as signed license leases, avatar data sent to the relay, and movement updates.

| Helper | Access | Notes |
| --- | --- | --- |
| `window._vortexRemotes` | Internal/dev | Map of currently tracked remote players. |
| `window._mpSetFriendStatus(id, status)` | Internal/dev | Updates local friend status display. |
| `window._mpUpdate(dt)` | Internal engine hook | Multiplayer update tick. |
| `window._mpSendChat(msg)` | Internal engine hook | Sends chat through the active bridge. |
| `window._mpHandleChatCommand(text)` | Internal engine hook | Parses and runs `::` chat commands. |
| `window._mpRebuildAvatars()` | Internal/dev | Rebuilds remote avatar meshes. |
| `window._mpCreateDummy(x, y, z, shirtUrl, ry)` | Internal/dev | Creates a local dummy character mesh. |

## Notes

- Hosted users should not need to send `session_token` to Vortex2+2 servers. Hosted mode uses the browser to get a launch token from Vortex, then the hosted relay verifies that launch token server-side.
- Local relay mode may use `session_token` locally on the user's machine to request a launch token. That is for local/private development and should not be sent to the hosted relay.
