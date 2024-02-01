import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../config/axios";
import apiRoutes from "../../constants/apiRoutes";
import Note from "../../types/Note";
import QueryPayload from "../../types/QueryPayload";

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
