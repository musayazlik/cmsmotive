import { Prisma } from "@/generated/prisma/client";

type FieldError = { status: number; body: { error: string } };

/**
 * Maps Prisma's unique-constraint violation onto a readable API response.
 * Returns null when the error is not a known conflict.
 */
export function prismaErrors(error: unknown, fallback: string): Response | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const response: FieldError = { status: 409, body: { error: "A record with this slug already exists." } };
      return Response.json(response.body, { status: response.status });
    }
    if (error.code === "P2025") {
      return Response.json({ error: "Record not found." }, { status: 404 });
    }
    if (error.code === "P2003") {
      return Response.json({ error: "A referenced record does not exist." }, { status: 400 });
    }
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
