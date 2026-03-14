# space-craft-planner

Webapp planner full-stack avec React côté client et Express/Mongoose côté serveur, prévue pour MongoDB Atlas.

## Stack

- React + Vite + TypeScript
- Express + Mongoose
- MongoDB Atlas

## Démarrage

1. Copier `server/.env.example` vers `server/.env`
2. Remplir `MONGODB_URI` avec votre URI MongoDB Atlas
3. Installer les dépendances:

   ```bash
   npm install
   ```

4. Lancer l'app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: lance le client et le serveur
- `npm run build`: build du frontend
- `npm run start`: démarre l'API Express

## API

- `GET /api/health`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
