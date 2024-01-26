import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../config/axios";
import apiRoutes from "../constants/apiRoutes";
import { clearSession, setSession } from "../utils/session";
import Toast from "../utils/toast";
import { Status } from "../types/ApiRequest";

type Payload = {
  name: string;
  email: string;
  password: string;
};

interface AuthState {
  status: Status;
}

const initialState: AuthState = {
  status: "idle",
};

export const login = createAsyncThunk(
  "auth/login",
  async (payload: Omit<Payload, "name">, { rejectWithValue }) => {
    try {
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

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => {
        state.status = "pending";
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "fulfilled";
        setSession(action.payload?.data?.token ?? "");
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "rejected";

        Toast.error(action.payload as string);
      })

      // register
      .addCase(register.pending, (state) => {
        state.status = "pending";
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "fulfilled";
        setSession(action.payload?.data?.token ?? "");
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      })

      // logout
      .addCase(logout.pending, (state) => {
        state.status = "pending";
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = "fulfilled";
        clearSession();
      })
      .addCase(logout.rejected, (state) => {
        state.status = "rejected";
        clearSession();
      });
  },
});

export default authSlice.reducer;
