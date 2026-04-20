import type { AppConfig } from "../config/config";

export interface HealthSnapshot {
  status: "ok";
  service: string;
  openaiConfigured: boolean;
  defaultModel: string;
  timestamp: string;
}

export interface HealthReader {
  getStatus(): HealthSnapshot;
}

export interface HealthServiceDependencies {
  config: AppConfig;
}

export const NewHealthService = ({
  config,
}: HealthServiceDependencies): HealthReader => {
  const getStatus = (): HealthSnapshot => {
    return {
      status: "ok",
      service: config.appName,
      openaiConfigured: Boolean(config.openaiApiKey),
      defaultModel: config.openaiModel,
      timestamp: new Date().toISOString(),
    };
  };

  return {
    getStatus,
  };
};
