import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";
import store from "./app/store.ts";
import "./index.scss";
import AuthProvider from "./provider/AuthProvider.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider>
          <App />
          <ToastContainer />
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);
