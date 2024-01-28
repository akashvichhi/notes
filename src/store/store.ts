import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../reducers/authSlice";
import profileReducer from "../reducers/profileSlice";
import notesReducer from "../reducers/notesSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    notes: notesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export default store;
