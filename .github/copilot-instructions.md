# Project Guidelines

## Stack And Scope
- Expo + React Native app using `expo-router` tabs.
- Primary source code lives under `src/app` (routes) and `src/components` (UI/business components).

## Architecture
- Route files in `src/app` should stay thin and delegate UI/business logic to components.
- Tab navigation is defined in `src/app/_layout.jsx`.
- Hidden route pattern is used for category detail (`src/app/category.jsx` with `href: null` in tabs).
- POS domain data is centralized in `src/components/pos/data.js` (`CATEGORY_ITEMS`, `CATEGORY_PRODUCTS`, `getCategoryById`).

## Build And Run
- Install dependencies: `npm install`
- Start dev server: `npm start`
- Run Android: `npm run android`
- Run iOS: `npm run ios`
- Run web: `npm run web`
- There are currently no `test`, `lint`, or production `build` scripts in `package.json`.

## Conventions
- Use functional components and hooks (`useState`, router hooks, safe-area hooks).
- Keep reusable POS UI pieces in `src/components/pos/components` and compose them from screen-level components.
- Prefer `StyleSheet.create` with local styles per component file.
- Preserve existing route-param navigation style using `router.push({ pathname, params })` and `useLocalSearchParams()`.
- Keep naming consistent with existing files in each folder (some files use lowercase exports, others PascalCase).

## Pitfalls
- `src/components/pos/pos.jsx` currently has a syntax error near the styles object (missing structure around `columnWrap`).
- `src/app/settings.jsx` is a placeholder screen.
- `src/components/login.jsx` uses placeholder `alert`-based auth flow with TODOs for real API integration.

## Key Reference Files
- `src/app/_layout.jsx`
- `src/app/category.jsx`
- `src/components/pos/pos.jsx`
- `src/components/pos/data.js`
- `src/components/login.jsx`
