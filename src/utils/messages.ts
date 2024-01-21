import { toast } from "react-toastify";

export const showSuccessMessage = (message: string) => {
  toast.success(message);
};

export const showErrorMessage = (message: string) => {
  toast.error(message);
};

export const showWarningMessage = (message: string) => {
  toast.warn(message);
};

export const showInfoMessage = (message: string) => {
  toast.info(message);
};
