import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { entriesService } from "@/modules/entries/entries.service";
import { createBookEntrySchema, createTextEntrySchema } from "@/types/api";

export async function GET(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const url = new URL(request.url);
    return entriesService.listEntries(auth.userId, url.searchParams);
  });
}

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const body = await request.json();

    if (body.entryType === "book") {
      const input = createBookEntrySchema.parse(body);
      return entriesService.createBookEntry(auth.userId, input);
    }

    const input = createTextEntrySchema.parse(body);
    return entriesService.createTextEntry(auth.userId, input);
  }, { status: 201 });
}
