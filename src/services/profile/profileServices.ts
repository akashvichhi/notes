import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../config/axios";
import apiRoutes from "../../constants/apiRoutes";
import User from "../../types/User";
import { camelToSnake } from "../../utils/utils";

type ChangePasswordPayload = {
  currentPassword: string;
  password: string;
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
