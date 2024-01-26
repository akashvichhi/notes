import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../config/axios";
import apiRoutes from "../constants/apiRoutes";
import User from "../types/User";
import Toast from "../utils/toast";
import { clearSession } from "../utils/session";
import { camelToSnake } from "../utils/utils";
import { Status } from "../types/ApiRequest";

type ChangePasswordPayload = {
  currentPassword: string;
  password: string;
};

interface ProfileState {
  status: Status;
  user: User | null;
}

const initialState: ProfileState = {
  status: "idle",
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
        state.status = "pending";
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.user = action.payload?.data?.user ?? null;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.status = "rejected";
        clearSession();
      })

      // update profile
      .addCase(updateProfile.pending, (state) => {
        state.status = "pending";
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.status = "fulfilled";
        if (action.payload?.data?.user) {
          state.user = action.payload.data.user;
        }
        Toast.success(
          action.payload?.message ?? "Profile updated successfully",
        );
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.status = "rejected";

        Toast.error(action.payload as string);
      })

      // change password
      .addCase(changePassword.pending, (state) => {
        state.status = "pending";
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.status = "fulfilled";
        Toast.success(
          action.payload?.message ?? "Password changed successfully",
        );
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.status = "rejected";
        Toast.error(action.payload as string);
      });
  },
});

export default profileSlice.reducer;
