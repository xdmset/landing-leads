# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Local Development

Run the frontend and backend in separate terminals:

```sh
npm run dev
npm run backend
```

The video endpoints stream private files from Backblaze B2. Create `backend/.env`
from `backend/.env.example` and fill in the real values before opening the site:

```sh
cp backend/.env.example backend/.env
```

Required for video playback:

```env
BACKBLAZE_KEY_ID=...
BACKBLAZE_APPLICATION_KEY=...
BACKBLAZE_BUCKET_NAME=...
BACKBLAZE_FILE_PREFIX=landing
```

If those values are missing, `/api/videos/...` returns a `503` configuration error
instead of streaming the MP4.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
