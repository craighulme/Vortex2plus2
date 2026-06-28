import { installFetchBridge } from "./fetchBridge";
import { injectMapLoader } from "./mapLoaderInjector";

injectMapLoader();
installFetchBridge();
