import { applyInitialTheme } from "./theme";
import { installPlayDocumentLoader } from "./playDocumentLoader";
import { installUpdateNotifier } from "./updateNotifier";
import { installPlayInBrowserButton } from "./playInBrowserButton";
import "../cosmetics/VortexWebCosmetics.js";
import "../cosmetics/ProfileCosmetics.js";

applyInitialTheme();
installPlayDocumentLoader();
installUpdateNotifier();
installPlayInBrowserButton();
