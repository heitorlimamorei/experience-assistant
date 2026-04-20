import { Hono } from "hono";

import type { HealthReader } from "../services/health.service";

export const NewHealthHandler = (healthService: HealthReader): Hono => {
  const handler = new Hono();

  handler.get("/health", (context) => {
    return context.json(healthService.getStatus());
  });

  return handler;
};
