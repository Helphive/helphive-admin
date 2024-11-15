# Helphive Admin

This folder contains the Node.js Express server for the HelpHive platform, handling all API requests, authentication, and database interactions.

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Environment Variables

Create a `.env` file based on the `.env.example`:

```
VITE_APP_VERSION=
GENERATE_SOURCEMAP=

VITE_APP_API_URL=
VITE_APP_JWT_SECRET_KEY=
VITE_APP_JWT_TIMEOUT=

## Google Map Key
VITE_APP_GOOGLE_MAPS_API_KEY=

## Map Box 
VITE_APP_MAPBOX_ACCESS_TOKEN=
```

### 3. Start the Server

```bash
yarn start
```
