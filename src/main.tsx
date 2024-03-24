import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";
import "./index.scss";
import AuthProvider from "./providers/AuthProvider.tsx";
import store from "./store/store.ts";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider>
          <App />
          <ToastContainer
            position="top-center"
            autoClose={5000}
            closeButton={false}
            transition={Slide}
          />
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);
