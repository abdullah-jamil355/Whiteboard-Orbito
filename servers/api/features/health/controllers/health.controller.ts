import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/index.js";
import type { HealthService } from "../services/index.js";

type HealthResponse = Pick<Response, "json" | "status" | "setHeader" | "end">;

export type HealthControllerDependencies = Readonly<{
  service: Pick<HealthService, "getHealth">;
}>;

export const createHealthController = ({ service }: HealthControllerDependencies) => {
  const getHealth = (_request: Request, response: HealthResponse): void => {
    response.status(HTTP_STATUS.ok).json(service.getHealth());
  };
  const getFavicon = (_request: Request, response: HealthResponse): void => {
    response.setHeader("Cache-Control", "public, max-age=86400");
    response.status(HTTP_STATUS.noContent).end();
  };
  return Object.assign(getHealth, { getHealth, getFavicon });
};
