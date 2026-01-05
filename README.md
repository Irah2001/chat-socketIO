# Web Temps Réel - Chat Application

Ce projet est une application de chat en temps réel construite avec **NestJS**, utilisant les **WebSockets** pour la communication bidirectionnelle et **Redis** pour la gestion de la scalabilité (Pub/Sub).

## Fonctionnalités

*   **Chat en temps réel** : Envoi et réception de messages instantanés.
*   **WebSockets** : Utilisation de `socket.io` pour une connexion persistante et rapide.
*   **Scalabilité** : Architecture prête pour le scaling horizontal grâce à l'adaptateur Redis.

## Prérequis

*   Docker et Docker Compose
*   Git
*   Node.js (optionnel, pour le lancement local sans Docker)

## Installation

Cloner le dépôt :

```bash
git clone https://github.com/Irah2001/chat-socketIO.git
cd chat-socketIO
```

## Comment faire fonctionner le projet

### Avec Docker (Recommandé)

Cette méthode lance à la fois l'application NestJS et le serveur Redis nécessaire.

1.  Lancer les services :
    ```bash
    cd app
    npm install
    cd ..
    docker compose up --build
    ```
2.  Accéder à l'application via votre navigateur : http://localhost:3000/front

### En local (Développement)

1.  Installer les dépendances :
    ```bash
    npm install
    ```
2.  S'assurer qu'une instance Redis tourne localement (port 6379 par défaut). Vous pouvez en lancer une via Docker :
    ```bash
    docker run -d -p 6379:6379 --name redis-local redis
    ```
3.  Lancer le serveur de développement :
    ```bash
    npm run start:dev
    ```

## Architecture

Le projet repose sur une architecture modulaire classique NestJS :

*   **Gateway (`ChatGateway`)** : Gère les connexions WebSocket, écoute les événements (messages entrants) et diffuse les réponses aux clients connectés.
*   **Redis Adapter** : Permet de diffuser les événements WebSocket entre plusieurs instances de l'application (Pub/Sub), assurant que les utilisateurs connectés à différentes instances du serveur peuvent communiquer entre eux.
*   **Client** : Une interface simple (HTML/JS) servie par le framework pour interagir avec le WebSocket.
