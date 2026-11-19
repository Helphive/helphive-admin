/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL of the HelpHive API. */
    readonly VITE_APP_API_URL?: string;
    /** Commit the build came from; set by CI, shown in the account menu. */
    readonly VITE_APP_BUILD?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
