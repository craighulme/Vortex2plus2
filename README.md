# Vortex Web

Vortex Web is an unofficial browser client for Vortex, built from the Vortex2+2 project and moving toward a complete modern rewrite for web play.

The goal is simple: keep Vortex playable in the browser, support native-style multiplayer through a relay, and build a cleaner web runtime that can grow with future Vortex features.

This is not an official Vortex client.

## What Is Changing

Vortex2+2 is being rebranded as Vortex Web.

The rebrand is more than a new name. Vortex Web is becoming a faster, more modular browser client with better update handling, cleaner runtime systems, stronger multiplayer support, and room for future features such as streamed assets, richer avatars, equipment, physics, and safe scripting support.

The current public focus is the playable web client. A web studio is not part of this plan.

## What Works Today

- Browser play from supported Vortex game pages
- Hosted WebSocket relay support for native-style multiplayer
- Extension-managed launch flow
- Multiplayer chat, player replication, health, swords, and building modes
- Current map loading and classic bundled maps
- Avatar clothing support for existing shirt, pants, face, body type, and colour data
- Command-gated movement tools for authorised users
- A new TypeScript/Vite web runtime that now boots alongside the live client

## Runtime Upgrade Progress

Vortex Web is being upgraded in stages so the browser client remains playable during the rewrite.

Already in the new web runtime:

- Modern boot bundle loaded by the extension
- Runtime service layer for renderer, world, avatar, animation, scripting permissions, protocol definitions, diagnostics, and UI
- Input and focus service for pointer lock, key state, shortcut blocking, and game focus
- Runtime HUD panel with live input, world, FPS, SLIM, streaming, sandbox, and avatar status
- SLIM-style distance band infrastructure for future mesh and streamed asset optimisation
- Rapier side-by-side physics backend with static map collider sync and raycast support
- Rapier collider debug drawing from the runtime panel
- Chat mounted through the new runtime service, with the old script kept as fallback
- Leaderboard exposed through a typed runtime bridge while the existing renderer stays compatible
- Client-only physics sandbox for stress testing, falling parts, and a kickable test ball
- Early asset streaming manifest validation for future models, meshes, textures, avatar items, map chunks, and script packages
- World map-part normalisation through the new `WorldService`, currently mirrored through the legacy add/remove backend
- Vortex-Web-only community cosmetic state for future badges, name gradients, nameplates, and supporter features
- Performance-first renderer defaults, connected-idle multiplayer throttling, and browser profiling helpers

Still being migrated:

- Full map loading and batching
- Full leaderboard renderer ownership inside `web-client`
- Rapier-driven dynamic bodies and movement parity testing
- Foot IK on an IK-friendly avatar rig
- Character movement replacement
- Avatar equipment slots for hats, masks, tools, shoes, and held items
- Production SLIM for real meshes, repeated assets, streamed UGC, and map chunks
- Streamed UGC models/assets from future Vortex APIs
- Script package loading and the public game API

Legacy gameplay remains active while these systems move across. That means movement, collision, build placement, sword hits, core map rendering, and multiplayer packets are still protected for compatibility.

## Multiplayer

The official Vortex app uses native networking. Browser extensions cannot use native UDP sockets directly, so Vortex Web uses a WebSocket relay model for browser multiplayer.

Public builds are designed around the hosted Vortex Web relay. Local relay mode exists for private development and testing, but it is not the normal public setup.

## Access

Vortex Web browser multiplayer is license-gated while the project is still moving fast. For access, contact `quackduck.` on Discord.

Command access is feature-gated. Some commands are available to all licensed users, while advanced movement tools require extra authorisation. See [COMMANDS_README.md](COMMANDS_README.md).

Hosted mode does not send your Vortex browser cookies or session token to Vortex Web servers. The extension uses your normal browser session locally to request a short-lived Vortex launch authorisation, then the hosted relay verifies that authorisation server-side.

## Installation

1. Download the latest release.
2. Unzip it.
3. Open `chrome://extensions`.
4. Enable developer mode.
5. Select `Load unpacked`.
6. Choose the folder containing this README.

## Troubleshooting

If the browser client stops loading, first reload the extension and refresh the Vortex game page. If the problem continues, disable other extensions that may be changing the same page.

If launch authorisation fails, the relay or license server may have rejected the request. Newer builds show the server reason where available.

For performance testing, launch from the game page with the normal Play in Web button. Reloading an already-running play page can drop the relay session.

## Credits

- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Search engine originally created by enk, modified and used with permission
- Crossroads by Shedletsky
- SFOTH by Shedletsky
- Sword fight baseplate by Inuk
- Building game by Inuk
- Party.exe map by 8DSK
- Fencing map by Stickmasterluke

## Screenshots

Vortex Web Building game:

![Vortex Web Building game](https://i.imgur.com/SooHiwI.jpeg)

Sword fight on the heights:

![Sword fight on the heights](https://media.discordapp.net/attachments/1497640288687100115/1502972700874899556/image.png?ex=6a06ede7&is=6a059c67&hm=a74ea0a22261862d10508df7a5e77764839d42ed480882d742e39d35c1ca3dc8&=&format=webp&quality=lossless)
