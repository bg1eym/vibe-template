import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    ownerId?: string;
  }
}
