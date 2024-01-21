import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiRoutes from "../config/apiRoutes";
import config from "../config/app";
import axios from "../config/axios";
import cookies from "../config/cookie";
import { showErrorMessage } from "../utils/messages";

type Payload = {
  name: string;
  email: string;
  password: string;
};

interface AuthState {
  isLoading: boolean;
  isSuccess: boolean;
}

const initialState: AuthState = {
  isLoading: false,
  isSuccess: false,
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
        state.isLoading = true;
        state.isSuccess = false;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;

        cookies.set(config.accessTokenKey, action.payload?.data?.token ?? null);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isSuccess = false;

        showErrorMessage(action.payload as string);
      })

      // register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.isSuccess = false;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;

        cookies.set(
          config.accessTokenKey,
          action?.payload?.data?.token ?? null,
        );
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.isSuccess = false;

        showErrorMessage(action.payload as string);
      })

      // logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
        state.isSuccess = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        cookies.remove(config.accessTokenKey);
      })
      .addCase(logout.rejected, (state) => {
        state.isLoading = false;
        cookies.remove(config.accessTokenKey);
      });
  },
});

export default authSlice.reducer;
