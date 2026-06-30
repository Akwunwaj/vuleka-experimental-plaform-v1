# ChatClan Tech Stack Decision

## Recommendation

Use **Node.js with Express and MariaDB** for the first production version.

## Why Node.js Fits ChatClan Better Than PHP

ChatClan is not only a content website. It needs webhook receivers, Meta Cloud API calls, campaign scheduling, background processing, inbox updates, and later worker queues. Node.js is a strong fit for that event-heavy shape while still being simple enough to run on DirectAdmin's Node.js application support.

The recommended first version is deliberately conservative:

- Express server-rendered HTML, so there is no fragile front-end build step on shared hosting.
- MariaDB via `mysql2`, matching Host Africa's available database service.
- API endpoints for campaigns, contacts, test messages, and webhooks.
- Environment variables for secrets and DirectAdmin configuration.
- Demo-data fallback when no database is configured, which makes local demos easy.

## When PHP Would Be A Good Choice

PHP would be reasonable if the product were mostly CRUD pages, forms, and admin screens, especially with Laravel. It is also often easier on traditional shared hosting. For ChatClan, however, PHP would likely need queues, workers, cron orchestration, and webhook handling that Node.js handles more naturally.

## Scaling Path

1. Start with one DirectAdmin Node.js app and MariaDB database.
2. Add a background worker process for campaign sending and webhook processing.
3. Move scheduled jobs to a queue such as BullMQ with Redis when client volume grows.
4. Split web app and worker app into separate processes.
5. Move to a VPS/container platform when shared hosting becomes the bottleneck.
