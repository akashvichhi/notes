import { createSlice } from "@reduxjs/toolkit";
import {
  changePassword,
  fetchProfile,
  updateProfile,
} from "../../services/profile/profileServices";
import { Status } from "../../types/ApiRequest";
import User from "../../types/User";
import { clearSession } from "../../utils/session";
import Toast from "../../utils/toast";

interface ProfileState {
  status: Status;
  user: User | null;
}

const initialState: ProfileState = {
  status: "idle",
  user: null,
};

export const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    clearState: () => {
      return initialState;
    },
  },
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
          action.payload?.message ?? "Profile updated successfully"
        );
      })
      .addCase(updateProfile.rejected, (state) => {
        state.status = "rejected";
      })

      // change password
      .addCase(changePassword.pending, (state) => {
        state.status = "pending";
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.status = "fulfilled";
        Toast.success(
          action.payload?.message ?? "Password changed successfully"
        );
      })
      .addCase(changePassword.rejected, (state) => {
        state.status = "rejected";
      });
  },
});

export const { clearState } = profileSlice.actions;

export default profileSlice.reducer;
