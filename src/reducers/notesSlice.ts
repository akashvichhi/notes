import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../config/axios";
import apiRoutes from "../constants/apiRoutes";
import { Status } from "../types/ApiRequest";
import Note from "../types/Note";
import QueryPayload from "../types/QueryPayload";
import Toast from "../utils/toast";
import { snakeToCamel } from "../utils/utils";

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

export const fetchNotes = createAsyncThunk(
  "notes/fetchNotes",
  async (query: QueryPayload, { rejectWithValue }) => {
    try {
      let url = apiRoutes.notes.list;
      if (query.search) {
        url += `?search=${query.search}`;
      }
      const response = await axios.get(url);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const fetchNote = createAsyncThunk(
  "notes/fetchNote",
  async (payload: Pick<Note, "id">, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        apiRoutes.notes.get.replace("{id}", payload.id!),
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const createNote = createAsyncThunk(
  "notes/createNote",
  async (payload: Note, { rejectWithValue }) => {
    try {
      const response = await axios.post(apiRoutes.notes.create, payload);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const renameNote = createAsyncThunk(
  "notes/renameNote",
  async (payload: Pick<Note, "id" | "name">, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        apiRoutes.notes.rename.replace("{id}", payload.id!),
        payload,
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const updateNote = createAsyncThunk(
  "notes/updateNote",
  async (payload: Pick<Note, "id" | "notes">, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        apiRoutes.notes.update.replace("{id}", payload.id!),
        payload,
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const deleteNote = createAsyncThunk(
  "notes/deleteNote",
  async (payload: Pick<Note, "id">, { rejectWithValue }) => {
    try {
      const response = await axios.delete(
        apiRoutes.notes.delete.replace("{id}", payload.id!),
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const forceDeleteNote = createAsyncThunk(
  "notes/forceDeleteNote",
  async (payload: Pick<Note, "id">, { rejectWithValue }) => {
    try {
      const response = await axios.delete(
        apiRoutes.notes.forceDelete.replace("{id}", payload.id!),
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const fetchTrash = createAsyncThunk(
  "notes/fetchTrash",
  async (query: QueryPayload, { rejectWithValue }) => {
    try {
      let url = apiRoutes.notes.trash;
      if (query.search) {
        url += `?search=${query.search}`;
      }
      const response = await axios.get(url);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const restoreNote = createAsyncThunk(
  "notes/restoreNote",
  async (payload: Pick<Note, "id">, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        apiRoutes.notes.restore.replace("{id}", payload.id!),
      );
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

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
