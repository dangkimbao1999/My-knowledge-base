import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { refreshEntrySearchDocument } from "@/modules/entries/search-document";
import type { NoteType } from "@/shared/enums";

type NoteInput = {
  noteType: NoteType;
  title?: string;
  content: string;
  chapterLabel?: string;
};

function serializeNote(note: {
  id: string;
  entryId: string;
  ownerId: string;
  noteType: string;
  title: string | null;
  content: string;
  chapterLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note.id,
    entryId: note.entryId,
    ownerId: note.ownerId,
    noteType: note.noteType,
    title: note.title,
    content: note.content,
    chapterLabel: note.chapterLabel,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

async function findOwnedEntry(userId: string, entryId: string) {
  const entry = await prisma.entry.findFirst({
    where: {
      id: entryId,
      ownerId: userId
    },
    select: {
      id: true
    }
  });

  if (!entry) {
    throw new ApiError("Entry not found", 404);
  }
}

async function findOwnedNote(userId: string, entryId: string, noteId: string) {
  const note = await prisma.entryNote.findFirst({
    where: {
      id: noteId,
      entryId,
      ownerId: userId
    }
  });

  if (!note) {
    throw new ApiError("Note not found", 404);
  }

  return note;
}

export const notesService = {
  async createNote(userId: string, entryId: string, input: NoteInput) {
    await findOwnedEntry(userId, entryId);

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.entryNote.create({
        data: {
          entryId,
          ownerId: userId,
          noteType: input.noteType,
          title: input.title ?? null,
          content: input.content,
          chapterLabel: input.chapterLabel ?? null
        }
      });

      await refreshEntrySearchDocument(tx, entryId);

      return created;
    });

    return serializeNote(note);
  },

  async updateNote(userId: string, entryId: string, noteId: string, input: NoteInput) {
    await findOwnedNote(userId, entryId, noteId);

    const note = await prisma.$transaction(async (tx) => {
      const updated = await tx.entryNote.update({
        where: {
          id: noteId
        },
        data: {
          noteType: input.noteType,
          title: input.title ?? null,
          content: input.content,
          chapterLabel: input.chapterLabel ?? null
        }
      });

      await refreshEntrySearchDocument(tx, entryId);

      return updated;
    });

    return serializeNote(note);
  },

  async deleteNote(userId: string, entryId: string, noteId: string) {
    await findOwnedNote(userId, entryId, noteId);

    await prisma.$transaction(async (tx) => {
      await tx.entryNote.delete({
        where: {
          id: noteId
        }
      });

      await refreshEntrySearchDocument(tx, entryId);
    });

    return {
      id: noteId,
      entryId,
      ownerId: userId,
      deleted: true
    };
  },

  async listNotes(userId: string, entryId: string) {
    await findOwnedEntry(userId, entryId);

    const notes = await prisma.entryNote.findMany({
      where: {
        entryId,
        ownerId: userId
      },
      orderBy: [
        {
          updatedAt: "desc"
        }
      ]
    });

    return {
      entryId,
      ownerId: userId,
      items: notes.map(serializeNote)
    };
  }
};
