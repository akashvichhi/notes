import { createSlice } from "@reduxjs/toolkit";
import { login, logout, register } from "../../actions/auth/authActions";
import { Status } from "../../types/ApiRequest";
import { clearSession, setSession } from "../../utils/session";
import Toast from "../../utils/toast";

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
        state.status = "idle";
      })
      .addCase(logout.fulfilled, () => {
        clearSession();
      })
      .addCase(logout.rejected, (_, action) => {
        Toast.error(action.payload as string);
      });
  },
});

export default authSlice.reducer;
