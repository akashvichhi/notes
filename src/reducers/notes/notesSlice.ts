import { createSlice } from "@reduxjs/toolkit";
import {
  createNote,
  deleteNote,
  fetchNote,
  fetchNotes,
  fetchTrash,
  forceDeleteNote,
  renameNote,
  restoreNote,
  updateNote,
} from "../../actions/notes/notesActions";
import { Status } from "../../types/ApiRequest";
import Note from "../../types/Note";
import Toast from "../../utils/toast";
import { snakeToCamel } from "../../utils/utils";

interface NoteState {
  status: Status;
  notesLoading: boolean;
  searchStatus: boolean;
  notes: Note[];
  trash: Note[];
  activeNoteId: string;
}

const initialState: NoteState = {
  status: "idle",
  notesLoading: false,
  searchStatus: false,
  notes: [],
  trash: [],
  activeNoteId: "",
};

export const notesSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    setActiveNoteId: (state, action) => {
      state.activeNoteId = action.payload;
    },
    updateCurrentNote: (state, action) => {
      state.notes = state.notes.map((note) => {
        if (note.id === action.payload.id) {
          return { ...note, notes: action.payload.notes, isSaved: false };
        }
        return note;
      });
      state.trash = state.trash.map((note) => {
        if (note.id === action.payload.id) {
          return { ...note, notes: action.payload.notes, isSaved: false };
        }
        return note;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch notes
      .addCase(fetchNotes.pending, (state) => {
        state.status = "pending";
        state.notesLoading = true;
        state.searchStatus = true;
      })
      .addCase(fetchNotes.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.notesLoading = false;
        state.searchStatus = false;
        state.notes = snakeToCamel(action.payload.data.notes);
      })
      .addCase(fetchNotes.rejected, (state) => {
        state.status = "rejected";
        state.notesLoading = false;
        state.searchStatus = false;
      })

      // fetch note
      .addCase(fetchNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(fetchNote.fulfilled, (state, action) => {
        const note: Note = snakeToCamel(action.payload.data.note);
        state.status = "fulfilled";
        if (note.isDeleted) {
          state.trash = state.trash.map((n: Note) =>
            n.id === note.id ? note : n,
          );
        } else {
          state.notes = state.notes.map((n: Note) =>
            n.id === note.id ? note : n,
          );
        }
      })
      .addCase(fetchNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // create note
      .addCase(createNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(createNote.fulfilled, (state, action) => {
        const note: Note = snakeToCamel(action.payload.data.note);
        state.status = "fulfilled";
        state.notes = [note, ...state.notes];
        Toast.success(action.payload?.message ?? "Note created successfully");
      })
      .addCase(createNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // rename note
      .addCase(renameNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(renameNote.fulfilled, (state, action) => {
        const { id, name } = action.meta.arg;
        state.status = "fulfilled";
        state.notes = state.notes.map((n: Note) =>
          n.id === id ? { ...n, name } : n,
        );
        Toast.success(action.payload?.message ?? "Note renamed successfully");
      })
      .addCase(renameNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // update note
      .addCase(updateNote.pending, (state, action) => {
        const noteId = action.meta.arg.id;
        const note: Note =
          state.notes.find((n: Note) => n.id === noteId) ??
          state.trash.find((n: Note) => n.id === noteId)!;
        note.isSaved = true;

        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
        state.notes = state.notes.map((n: Note) =>
          n.id === noteId ? note : n,
        );
        state.trash = state.trash.map((n: Note) =>
          n.id === noteId ? note : n,
        );
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        state.status = "fulfilled";
        Toast.success(action.payload?.message ?? "Note updated successfully");
      })
      .addCase(updateNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // delete note
      .addCase(deleteNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        const id: string = action.meta.arg.id!;
        const note: Note = state.notes.find((n: Note) => n.id === id)!;
        note.isDeleted = true;

        const notes = state.notes.filter((n: Note) => n.id !== id);
        const activeId: string = notes[0]?.id ?? "";

        state.status = "fulfilled";
        state.activeNoteId = activeId;
        state.notes = notes;
        state.trash = [note, ...state.trash];
        Toast.success(action.payload?.message ?? "Note deleted successfully");
      })
      .addCase(deleteNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // force delete note
      .addCase(forceDeleteNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(forceDeleteNote.fulfilled, (state, action) => {
        const id: string = action.meta.arg.id!;
        const trash = state.trash.filter((n: Note) => n.id !== id);
        const activeId: string = trash[0]?.id ?? "";

        state.status = "fulfilled";
        state.activeNoteId = activeId;
        state.trash = trash;
        Toast.success(action.payload?.message ?? "Note deleted successfully");
      })
      .addCase(forceDeleteNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // fetch trash
      .addCase(fetchTrash.pending, (state) => {
        state.status = "pending";
        state.notesLoading = true;
        state.searchStatus = false;
      })
      .addCase(fetchTrash.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.notesLoading = false;
        state.trash = snakeToCamel(
          action.payload.data.notes.map((note: Note) => ({
            ...note,
            isSaved: true,
          })),
        );
      })
      .addCase(fetchTrash.rejected, (state, action) => {
        state.status = "rejected";
        state.notesLoading = false;
        Toast.error(action.payload as string);
      })

      // restore note
      .addCase(restoreNote.pending, (state) => {
        state.status = "pending";
        state.notesLoading = false;
        state.searchStatus = false;
      })
      .addCase(restoreNote.fulfilled, (state, action) => {
        const id: string = action.meta.arg.id!;
        const note: Note = state.trash.find((n: Note) => n.id === id)!;
        note.isDeleted = false;

        const trash = state.trash.filter((n: Note) => n.id !== id);
        const activeId: string = trash[0]?.id ?? "";

        state.status = "fulfilled";
        state.activeNoteId = activeId;
        state.trash = trash;
        state.notes = [note, ...state.notes];
        Toast.success(action.payload?.message ?? "Note restored successfully");
      })
      .addCase(restoreNote.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      });
  },
});

export const { setActiveNoteId, updateCurrentNote } = notesSlice.actions;

export default notesSlice.reducer;
