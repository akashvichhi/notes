import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiRoutes from "../config/apiRoutes";
import axios from "../config/axios";
import User from "../types/User";
import { clearSession } from "../utils/session";

interface ProfileState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  user: User | null;
}

const initialState: ProfileState = {
  isLoading: true,
  isSuccess: false,
  isError: false,
  user: null,
};

export const fetchProfile = createAsyncThunk(
  "profile/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(apiRoutes.profile);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetch profile
      .addCase(fetchProfile.pending, (state) => {
        state.isLoading = true;
        state.isSuccess = false;
        state.isError = false;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.user = action.payload?.data?.user ?? null;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.isLoading = false;
        state.isSuccess = false;
        state.isError = true;
        clearSession();
      });
  },
});

export default profileSlice.reducer;
