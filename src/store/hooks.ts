import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AuthContext } from "../providers/AuthProvider";
import type { AppDispatch, RootState } from "./store";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export const useAuth = () => useContext(AuthContext);
