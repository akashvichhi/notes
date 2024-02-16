import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../config/axios";
import apiRoutes from "../../constants/apiRoutes";

type Payload = {
  name: string;
  email: string;
  password: string;
  isDesktop?: boolean;
};

export const login = createAsyncThunk(
  "auth/login",
  async (payload: Omit<Payload, "name">, { rejectWithValue }) => {
    try {
      // @ts-expect-error "notes" will be specified in desktop app
      if (window.notes) {
        payload.isDesktop = true;
      }
      const response = await axios.post(apiRoutes.login, payload);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (payload: Payload, { rejectWithValue }) => {
    try {
      const response = await axios.post(apiRoutes.register, payload);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.post(apiRoutes.logout);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);
