import { createSlice } from "@reduxjs/toolkit";
import { login, logout, register } from "../../services/auth/authServices";
import { Status } from "../../types/ApiRequest";
import { clearSession, setSession } from "../../utils/session";

interface AuthState {
  status: Status;
}

const initialState: AuthState = {
  status: "idle",
};

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
      .addCase(login.rejected, (state) => {
        state.status = "rejected";
      })

      // register
      .addCase(register.pending, (state) => {
        state.status = "pending";
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "fulfilled";
        setSession(action.payload?.data?.token ?? "");
      })
      .addCase(register.rejected, (state) => {
        state.status = "rejected";
      })

      // logout
      .addCase(logout.pending, (state) => {
        state.status = "idle";
      })
      .addCase(logout.fulfilled, () => {
        clearSession();
      })
      .addCase(logout.rejected, () => {
        //
      });
  },
});

export default authSlice.reducer;
