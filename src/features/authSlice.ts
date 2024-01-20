import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import config from "../config/app";
import axios from "../config/axios";
import cookies from "../config/cookie";
import { User } from "../types/User";

type Payload = {
  email: string;
  password: string;
};

interface AuthState {
  isLoading: boolean;
  user: User | null;
}

const initialState: AuthState = {
  isLoading: false,
  user: null,
};

const login = createAsyncThunk(
  "auth/login",
  async (payload: Payload, { rejectWithValue }) => {
    try {
      const response = await axios.post("/auth/login", payload);
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
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.data.user;

        cookies.set(config.accessTokenKey, action.payload.data.token);
      })
      .addCase(login.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
      });
  },
});

export default authSlice.reducer;
