import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiRoutes from "../config/apiRoutes";
import axios from "../config/axios";
import User from "../types/User";
import { showErrorMessage, showSuccessMessage } from "../utils/messages";
import { clearSession } from "../utils/session";
import { camelToSnake } from "../utils/utils";

type ChangePasswordPayload = {
  currentPassword: string;
  password: string;
};

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
      const response = await axios.get(apiRoutes.profile.get);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const updateProfile = createAsyncThunk(
  "profile/updateProfile",
  async (payload: Partial<User>, { rejectWithValue }) => {
    try {
      const response = await axios.put(apiRoutes.profile.update, payload);
      return response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ?? "Something went wrong",
      );
    }
  },
);

export const changePassword = createAsyncThunk(
  "profile/changePassword",
  async (payload: ChangePasswordPayload, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        apiRoutes.profile.changePassword,
        camelToSnake(payload),
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
      })

      // update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.isSuccess = false;
        state.isError = false;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.data?.user) {
          state.user = action.payload.data.user;
        }
        showSuccessMessage(
          action.payload?.message ?? "Profile updated successfully",
        );
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;

        showErrorMessage(action.payload as string);
      })

      // change password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.isSuccess = false;
        state.isError = false;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        showSuccessMessage(
          action.payload?.message ?? "Password changed successfully",
        );
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        showErrorMessage(action.payload as string);
      });
  },
});

export default profileSlice.reducer;
