# Vortex2+2
## Access and auth

Vortex2+2 browser multiplayer is license-gated. To get a key, or to request more authorisation for restricted commands, contact `quackduck.` on Discord.

Hosted mode does not send user session tokens or browser cookies to Vortex2+2 servers. The extension uses the user's existing Vortex browser session locally to request a normal short-lived game authorisation token from Vortex, then sends that game authorisation token and the signed Vortex2+2 license lease to the hosted relay. The hosted relay verifies the game authorisation token server-side and keeps relay secrets out of the extension.

Command access is documented in [COMMANDS_README.md](COMMANDS_README.md).

## Browser play

This fork injects a `Play in Browser` button on `https://playvortex.io/games/{id}`. The button fetches the normal Vortex launch token with your existing browser login and opens the Vortex2+2 browser client.

The official app now uses UDP for live multiplayer. Browser extensions cannot open UDP sockets, so live Vortex multiplayer uses a WebSocket-to-UDP relay. Public builds default to the hosted Vortex2+2 relay.

Local relay mode is not the supported public setup. It is possible for private development or self-hosted/reverse-engineering work, but you must do that work yourself and provide your own local relay/runtime configuration.

~~Local relay launch scripts are no longer shipped as the public setup.~~

The historical local relay URL is `ws://127.0.0.1:27822/ws`, but public users should use the hosted default unless they are deliberately building and maintaining their own local relay.

Credits:
- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Search engine originally created by enk, modified and used with permission
- Maps:
- Crossroads by Shedletsky
- SFOTH by Shedletsky
- Sword fight baseplate by Inuk
- Building game by Inuk
- Party.exe map by 8DSK
- Fencing map by Stickmasterluke

current features are:
- Clean custom dark ui
- Map loader
- Normal mapping
- Shadows
- Custom games
- Multiplayer health and sword system
- Multiplayer building game

**If you encounter any issues with Vortex2+2 breaking the game,**
**please check if you have any other extentions installed and disable them.**
**If not, it's probably a vortex update and you should wait until a new release is out**

installation:
1. download the latest release
2. unzip it
3. go to chrome://extensions
4. enable developer mode
5. press 'load unpacked' and select the folder containing this file!

Vortex2+2 Building game:

![Vortex2+2 Building game](https://i.imgur.com/SooHiwI.jpeg)


Sword fight on the heights:

![Sword fight on the heights](https://media.discordapp.net/attachments/1497640288687100115/1502972700874899556/image.png?ex=6a06ede7&is=6a059c67&hm=a74ea0a22261862d10508df7a5e77764839d42ed480882d742e39d35c1ca3dc8&=&format=webp&quality=lossless)


If you like vortex2+2 please consider starring this github and sharing this with your friends!
