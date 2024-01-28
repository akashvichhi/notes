import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";
import "./index.scss";
import SplashScreen from "./pages/Splash.tsx";
import AuthProvider from "./providers/AuthProvider.tsx";
import store from "./store/store.ts";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider>
          <Suspense fallback={<SplashScreen />}>
            <App />
          </Suspense>
          <ToastContainer position="top-center" />
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);
