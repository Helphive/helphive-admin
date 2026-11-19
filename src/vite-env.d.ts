/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL of the HelpHive API. */
    readonly VITE_APP_API_URL?: string;
    /** Commit the build came from; set by CI, shown in the account menu. */
    readonly VITE_APP_BUILD?: string;
    /** "live" to link Stripe ids to the live dashboard; anything else links to test mode. */
    readonly VITE_APP_STRIPE_MODE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
